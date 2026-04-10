"""
BESS + Generator hybrid dispatch simulation — with stop/start hysteresis.

Dispatch strategy (efficiency_optimal):
  • Generator targets optimal load point (default 75%) — diesel sweet spot.
  • BESS charges on excess generation, discharges on demand shortfalls.
  • Generator turns OFF when:
      - BESS SOC is high enough to cover load alone (SOC > soc_high_threshold), AND
      - Load has been below gen_min_load_pct for >= consecutive_low_load_hours.
        (Prevents wet-stacking / under-loading damage.)
  • Generator turns ON when:
      - BESS SOC drops to soc_low_threshold, OR
      - Demand exceeds what BESS can deliver.
  • Minimum off-time: 1 hour after stopping (prevents rapid cycling).

Returns hour-by-hour arrays plus totals for gen-only baseline vs hybrid.
"""
from dataclasses import dataclass, field
from app.calculators.fuel import interpolate_fuel_rate
from app.calculators.emissions import diesel_co2e_kg_per_liter

DIESEL_CO2E = diesel_co2e_kg_per_liter()

# Defaults — all overridable via simulate()
DEFAULT_TARGET_LOAD_PCT   = 75.0   # Generator efficiency sweet spot
DEFAULT_MIN_LOAD_PCT      = 30.0   # Below this → wet stacking risk; shutdown allowed
DEFAULT_SOC_LOW_THRESHOLD = 0.20   # Force gen start when SOC hits this
DEFAULT_SOC_HIGH_THRESHOLD = 0.65  # Allow gen stop when SOC is above this
DEFAULT_CONSEC_LOW_BEFORE_STOP = 2  # Consecutive hours below min load before stopping
DEFAULT_MIN_OFF_HOURS      = 1     # Minimum hours gen stays off after stopping


@dataclass
class ScenarioResult:
    total_fuel_liters: float
    co2e_kg: float
    fuel_cost_usd: float
    runtime_hours: float
    avg_load_pct: float
    gen_starts: int = 0
    hourly_fuel: list[float] = field(default_factory=list)
    hourly_gen_running: list[bool] = field(default_factory=list)
    # Hybrid-only fields
    bess_cycles: float = 0.0
    hourly_soc: list[float] = field(default_factory=list)


def _baseline(gen_kw: float, fuel_curve: dict, hourly_kw: list[float],
              fuel_price: float) -> ScenarioResult:
    """Generator running alone, load-following (no BESS)."""
    fuels, load_pcts = [], []
    for demand in hourly_kw:
        lp = max(25.0, min(100.0, (demand / gen_kw) * 100.0))
        fuels.append(interpolate_fuel_rate(lp, fuel_curve))
        load_pcts.append(lp)

    total_fuel = sum(fuels)
    return ScenarioResult(
        total_fuel_liters=round(total_fuel, 2),
        co2e_kg=round(total_fuel * DIESEL_CO2E, 2),
        fuel_cost_usd=round(total_fuel * fuel_price, 2),
        runtime_hours=24.0,
        avg_load_pct=round(sum(load_pcts) / 24, 1),
        gen_starts=1,
        hourly_fuel=[round(f, 3) for f in fuels],
        hourly_gen_running=[True] * 24,
    )


def _hybrid(
    gen_kw: float,
    fuel_curve: dict,
    hourly_kw: list[float],
    capacity_kwh: float,
    power_kw: float,
    rte: float,
    min_soc: float,
    max_soc: float,
    fuel_price: float,
    target_load_pct: float = DEFAULT_TARGET_LOAD_PCT,
    min_load_pct: float = DEFAULT_MIN_LOAD_PCT,
    soc_low_threshold: float = DEFAULT_SOC_LOW_THRESHOLD,
    soc_high_threshold: float = DEFAULT_SOC_HIGH_THRESHOLD,
    consec_low_before_stop: int = DEFAULT_CONSEC_LOW_BEFORE_STOP,
    min_off_hours: int = DEFAULT_MIN_OFF_HOURS,
) -> ScenarioResult:
    """Generator + BESS dispatch with stop/start hysteresis."""
    opt_kw      = gen_kw * (target_load_pct / 100.0)
    min_load_kw = gen_kw * (min_load_pct / 100.0)
    soc_kwh     = capacity_kwh * max_soc   # Start BESS full
    min_kwh     = capacity_kwh * min_soc
    max_kwh     = capacity_kwh * max_soc
    soc_low_kwh  = capacity_kwh * soc_low_threshold
    soc_high_kwh = capacity_kwh * soc_high_threshold

    fuels: list[float]        = []
    soc_trace: list[float]    = []
    running_trace: list[bool] = []
    load_pcts: list[float]    = []
    total_discharge = 0.0
    runtime = 0.0
    gen_starts = 0

    gen_running = True           # Generator starts ON
    consec_low_hours = 0         # Counter for consecutive low-load hours
    hours_since_stop = min_off_hours  # Allow stopping immediately at t=0

    for demand in hourly_kw:
        hours_since_stop += 1
        available_discharge = min(power_kw, soc_kwh - min_kwh)
        actual_load_pct = (demand / gen_kw) * 100.0

        # ── Generator stop logic ─────────────────────────────────────────
        if gen_running:
            if actual_load_pct < min_load_pct:
                consec_low_hours += 1
            else:
                consec_low_hours = 0

            can_stop = (
                consec_low_hours >= consec_low_before_stop
                and soc_kwh >= soc_high_kwh
                and available_discharge >= demand
                and hours_since_stop >= min_off_hours
            )
            if can_stop:
                gen_running = False
                consec_low_hours = 0
                hours_since_stop = 0

        # ── Generator start logic ────────────────────────────────────────
        elif not gen_running:
            must_start = (
                soc_kwh <= soc_low_kwh
                or demand > available_discharge
            )
            if must_start and hours_since_stop >= min_off_hours:
                gen_running = True
                gen_starts += 1
                consec_low_hours = 0

        # ── Hourly dispatch ──────────────────────────────────────────────
        if not gen_running:
            # BESS covers load entirely
            fuel = 0.0
            discharge = min(demand / rte, available_discharge)
            soc_kwh  -= discharge
            total_discharge += discharge
        elif demand > gen_kw:
            # Overload: gen at 100%, BESS covers overflow
            fuel = interpolate_fuel_rate(100.0, fuel_curve)
            overflow   = demand - gen_kw
            discharge  = min(overflow / rte, available_discharge)
            soc_kwh   -= discharge
            total_discharge += discharge
            runtime   += 1.0
            load_pcts.append(100.0)
        else:
            # Gen at target load; BESS absorbs excess or covers shortfall
            fuel   = interpolate_fuel_rate(target_load_pct, fuel_curve)
            delta  = opt_kw - demand
            if delta >= 0:
                charge   = min(delta * rte, max_kwh - soc_kwh, power_kw * rte)
                soc_kwh += charge
            else:
                discharge       = min(abs(delta) / rte, available_discharge)
                soc_kwh        -= discharge
                total_discharge += discharge
            runtime += 1.0
            load_pcts.append(target_load_pct)

        # Clamp SOC
        soc_kwh = max(min_kwh, min(max_kwh, soc_kwh))

        fuels.append(fuel)
        soc_trace.append(round(soc_kwh / capacity_kwh, 4))
        running_trace.append(gen_running)

    total_fuel = sum(fuels)
    avg_lp = round(sum(load_pcts) / len(load_pcts), 1) if load_pcts else 0.0

    return ScenarioResult(
        total_fuel_liters=round(total_fuel, 2),
        co2e_kg=round(total_fuel * DIESEL_CO2E, 2),
        fuel_cost_usd=round(total_fuel * fuel_price, 2),
        runtime_hours=round(runtime, 1),
        avg_load_pct=avg_lp,
        gen_starts=gen_starts,
        hourly_fuel=[round(f, 3) for f in fuels],
        hourly_gen_running=running_trace,
        bess_cycles=round(total_discharge / capacity_kwh, 3) if capacity_kwh > 0 else 0,
        hourly_soc=soc_trace,
    )


def simulate(
    gen_kw: float,
    fuel_curve: dict,
    capacity_kwh: float,
    power_kw: float,
    rte: float,
    min_soc: float,
    max_soc: float,
    hourly_kw: list[float],
    fuel_price: float,
    fuel_type: str = "diesel",
    target_load_pct: float = DEFAULT_TARGET_LOAD_PCT,
    min_load_pct: float = DEFAULT_MIN_LOAD_PCT,
    soc_low_threshold: float = DEFAULT_SOC_LOW_THRESHOLD,
    soc_high_threshold: float = DEFAULT_SOC_HIGH_THRESHOLD,
    consec_low_before_stop: int = DEFAULT_CONSEC_LOW_BEFORE_STOP,
    min_off_hours: int = DEFAULT_MIN_OFF_HOURS,
) -> dict:
    base = _baseline(gen_kw, fuel_curve, hourly_kw, fuel_price)
    hyb  = _hybrid(
        gen_kw, fuel_curve, hourly_kw,
        capacity_kwh, power_kw, rte, min_soc, max_soc, fuel_price,
        target_load_pct, min_load_pct,
        soc_low_threshold, soc_high_threshold,
        consec_low_before_stop, min_off_hours,
    )

    fuel_saved   = base.total_fuel_liters - hyb.total_fuel_liters
    savings_pct  = (fuel_saved / base.total_fuel_liters * 100) if base.total_fuel_liters > 0 else 0

    return {
        "generator_only": {
            "total_fuel_liters": base.total_fuel_liters,
            "co2e_kg":           base.co2e_kg,
            "fuel_cost_usd":     base.fuel_cost_usd,
            "runtime_hours":     base.runtime_hours,
            "avg_load_pct":      base.avg_load_pct,
            "gen_starts":        base.gen_starts,
            "hourly_fuel":       base.hourly_fuel,
            "hourly_gen_running": base.hourly_gen_running,
        },
        "hybrid": {
            "total_fuel_liters": hyb.total_fuel_liters,
            "co2e_kg":           hyb.co2e_kg,
            "fuel_cost_usd":     hyb.fuel_cost_usd,
            "runtime_hours":     hyb.runtime_hours,
            "avg_load_pct":      hyb.avg_load_pct,
            "gen_starts":        hyb.gen_starts,
            "bess_cycles":       hyb.bess_cycles,
            "hourly_fuel":       hyb.hourly_fuel,
            "hourly_gen_running": hyb.hourly_gen_running,
            "hourly_soc":        hyb.hourly_soc,
        },
        "savings": {
            "fuel_liters":              round(fuel_saved, 2),
            "co2e_kg":                  round(base.co2e_kg - hyb.co2e_kg, 2),
            "fuel_cost_usd":            round(base.fuel_cost_usd - hyb.fuel_cost_usd, 2),
            "runtime_reduction_hours":  round(base.runtime_hours - hyb.runtime_hours, 1),
            "gen_starts_reduction":     base.gen_starts - hyb.gen_starts,
            "savings_pct":              round(savings_pct, 1),
        },
        "dispatch_config": {
            "target_load_pct":          target_load_pct,
            "min_load_pct":             min_load_pct,
            "soc_low_threshold_pct":    soc_low_threshold * 100,
            "soc_high_threshold_pct":   soc_high_threshold * 100,
            "consec_low_before_stop":   consec_low_before_stop,
            "min_off_hours":            min_off_hours,
        },
    }
