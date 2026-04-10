"""
BESS + Generator hybrid dispatch simulation.

Strategy:
  1. Run generator at optimal efficiency point (75% of rated kW).
  2. BESS absorbs excess generation (charging) or fills demand gaps (discharging).
  3. Generator shuts off if BESS SOC is high enough to cover the load alone.
  4. Generator runs at 100% if demand exceeds rated kW (BESS assists overflow).

Returns hour-by-hour arrays plus totals for generator-only baseline and hybrid.
"""
from dataclasses import dataclass, field
from app.calculators.fuel import interpolate_fuel_rate
from app.calculators.emissions import diesel_co2e_kg_per_liter

DIESEL_CO2E = diesel_co2e_kg_per_liter()
GEN_OPTIMAL_LOAD_PCT = 75.0   # Diesel efficiency sweet spot


@dataclass
class ScenarioResult:
    total_fuel_liters: float
    co2e_kg: float
    fuel_cost_usd: float
    runtime_hours: float
    avg_load_pct: float
    hourly_fuel: list[float] = field(default_factory=list)
    # Hybrid-only fields
    bess_cycles: float = 0.0
    hourly_soc: list[float] = field(default_factory=list)


def _baseline(gen_kw: float, fuel_curve: dict, hourly_kw: list[float],
              fuel_price: float) -> ScenarioResult:
    """Generator running alone, load-following."""
    fuels = []
    load_pcts = []
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
        hourly_fuel=[round(f, 3) for f in fuels],
    )


def _hybrid(gen_kw: float, fuel_curve: dict, hourly_kw: list[float],
            capacity_kwh: float, power_kw: float, rte: float,
            min_soc: float, max_soc: float, fuel_price: float) -> ScenarioResult:
    """Generator + BESS dispatch."""
    opt_kw = gen_kw * (GEN_OPTIMAL_LOAD_PCT / 100.0)
    soc_kwh = capacity_kwh * max_soc   # Start full
    min_kwh = capacity_kwh * min_soc
    max_kwh = capacity_kwh * max_soc

    fuels: list[float] = []
    soc_trace: list[float] = []
    load_pcts: list[float] = []
    runtime = 0.0
    total_discharge = 0.0

    for demand in hourly_kw:
        available_discharge = min(power_kw, soc_kwh - min_kwh)

        # Can BESS carry the load alone? (gen off to preserve fuel)
        if demand <= available_discharge and soc_kwh > min_kwh * 1.3:
            fuel = 0.0
            soc_kwh -= demand / rte
        elif demand > gen_kw:
            # Overload — gen at 100%, BESS discharges overflow
            fuel = interpolate_fuel_rate(100.0, fuel_curve)
            overflow = demand - gen_kw
            discharge = min(overflow / rte, available_discharge)
            soc_kwh -= discharge
            total_discharge += discharge
            runtime += 1.0
            load_pcts.append(100.0)
        else:
            # Generator at optimal; BESS charges or discharges delta
            fuel = interpolate_fuel_rate(GEN_OPTIMAL_LOAD_PCT, fuel_curve)
            delta_kw = opt_kw - demand
            if delta_kw >= 0:
                # Gen overproducing — charge BESS
                charge = min(delta_kw * rte, max_kwh - soc_kwh, power_kw * rte)
                soc_kwh += charge
            else:
                # Gen underproducing — discharge BESS
                need = abs(delta_kw) / rte
                discharge = min(need, available_discharge)
                soc_kwh -= discharge
                total_discharge += discharge
            runtime += 1.0
            load_pcts.append(GEN_OPTIMAL_LOAD_PCT)

        fuels.append(fuel)
        soc_trace.append(round(soc_kwh / capacity_kwh, 4))

    total_fuel = sum(fuels)
    avg_lp = round(sum(load_pcts) / len(load_pcts), 1) if load_pcts else 0.0

    return ScenarioResult(
        total_fuel_liters=round(total_fuel, 2),
        co2e_kg=round(total_fuel * DIESEL_CO2E, 2),
        fuel_cost_usd=round(total_fuel * fuel_price, 2),
        runtime_hours=round(runtime, 1),
        avg_load_pct=avg_lp,
        hourly_fuel=[round(f, 3) for f in fuels],
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
) -> dict:
    base = _baseline(gen_kw, fuel_curve, hourly_kw, fuel_price)
    hyb = _hybrid(gen_kw, fuel_curve, hourly_kw,
                  capacity_kwh, power_kw, rte, min_soc, max_soc, fuel_price)

    fuel_saved = base.total_fuel_liters - hyb.total_fuel_liters
    savings_pct = (fuel_saved / base.total_fuel_liters * 100) if base.total_fuel_liters > 0 else 0

    return {
        "generator_only": {
            "total_fuel_liters": base.total_fuel_liters,
            "co2e_kg": base.co2e_kg,
            "fuel_cost_usd": base.fuel_cost_usd,
            "runtime_hours": base.runtime_hours,
            "avg_load_pct": base.avg_load_pct,
            "hourly_fuel": base.hourly_fuel,
        },
        "hybrid": {
            "total_fuel_liters": hyb.total_fuel_liters,
            "co2e_kg": hyb.co2e_kg,
            "fuel_cost_usd": hyb.fuel_cost_usd,
            "runtime_hours": hyb.runtime_hours,
            "avg_load_pct": hyb.avg_load_pct,
            "bess_cycles": hyb.bess_cycles,
            "hourly_fuel": hyb.hourly_fuel,
            "hourly_soc": hyb.hourly_soc,
        },
        "savings": {
            "fuel_liters": round(fuel_saved, 2),
            "co2e_kg": round(base.co2e_kg - hyb.co2e_kg, 2),
            "fuel_cost_usd": round(base.fuel_cost_usd - hyb.fuel_cost_usd, 2),
            "runtime_reduction_hours": round(base.runtime_hours - hyb.runtime_hours, 1),
            "savings_pct": round(savings_pct, 1),
        },
    }
