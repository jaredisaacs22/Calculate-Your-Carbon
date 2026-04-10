import numpy as np


def interpolate_fuel_rate(load_pct: float, fuel_curve: dict) -> float:
    """
    Interpolate fuel consumption (L/hr) at any load point.

    fuel_curve: {"25": 3.2, "50": 5.8, "75": 8.1, "100": 10.9}
    load_pct:   operating load as % of rated kW (clamped to curve min/max)
    """
    load_points = sorted(float(k) for k in fuel_curve.keys())
    fuel_rates = [float(fuel_curve[str(int(k)) if k == int(k) else str(k)]) for k in load_points]
    load_pct = float(max(load_points[0], min(load_points[-1], load_pct)))
    return float(np.interp(load_pct, load_points, fuel_rates))


def fuel_at_kw(kw_output: float, kw_rating: float, fuel_curve: dict) -> float:
    """Convenience wrapper — takes absolute kW output instead of %."""
    if kw_rating <= 0:
        return 0.0
    load_pct = (kw_output / kw_rating) * 100.0
    return interpolate_fuel_rate(load_pct, fuel_curve)
