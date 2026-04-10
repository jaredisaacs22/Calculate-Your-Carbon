from typing import Optional
from pydantic import BaseModel


class SimulationRequest(BaseModel):
    generator_id: int
    bess_id: int
    load_profile_id: Optional[int] = None
    custom_hourly_kw: Optional[list[float]] = None   # 24 values, overrides profile
    fuel_price_per_liter: float = 1.35


class HourlyResult(BaseModel):
    generator_only: dict   # keys: total_fuel_liters, co2e_kg, fuel_cost_usd,
    #                              runtime_hours, avg_load_pct, hourly_fuel
    hybrid: dict           # + bess_cycles, hourly_soc
    savings: dict          # fuel_liters, co2e_kg, fuel_cost_usd,
    #                              runtime_reduction_hours, savings_pct
