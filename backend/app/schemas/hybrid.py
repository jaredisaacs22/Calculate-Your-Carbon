from typing import Optional
from pydantic import BaseModel


class DispatchConfig(BaseModel):
    """Optional overrides for the hybrid dispatch algorithm."""
    target_load_pct: float = 75.0        # Generator optimal load target (%)
    min_load_pct: float = 30.0           # Below this → wet stacking risk; stop allowed
    soc_low_threshold: float = 0.20      # Force gen start when SOC hits this fraction
    soc_high_threshold: float = 0.65     # Allow gen stop when SOC is above this
    consec_low_before_stop: int = 2      # Consecutive hours below min before stopping
    min_off_hours: int = 1               # Minimum hours gen must stay off after stopping


class SimulationRequest(BaseModel):
    generator_id: int
    bess_id: int
    load_profile_id: Optional[int] = None
    custom_hourly_kw: Optional[list[float]] = None   # 24 values, overrides profile
    fuel_price_per_liter: float = 1.35
    dispatch: Optional[DispatchConfig] = None        # If None, uses defaults
