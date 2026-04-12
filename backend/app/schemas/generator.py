from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class GeneratorBase(BaseModel):
    oem: str
    model: str
    kw_rating: float
    kva_rating: Optional[float] = None
    fuel_type: str = "diesel"
    fuel_curve: Optional[dict] = None
    emissions_data: Optional[dict] = None
    dimensions_mm: Optional[dict] = None
    weight_kg: Optional[float] = None
    noise_db_at_7m: Optional[float] = None
    emissions_standard: Optional[str] = None
    description: Optional[str] = None
    source_url: Optional[str] = None


class GeneratorCreate(GeneratorBase):
    pass


class GeneratorRead(GeneratorBase):
    id: int
    is_active: bool
    scraped_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CompareRequest(BaseModel):
    ids: list[int]           # 2–4 generator IDs
    load_pct: float = 75.0   # Operating load point (25–100)
    fuel_price_per_liter: float = 1.35


class GeneratorMetrics(BaseModel):
    generator_id: int
    oem: str
    model: str
    kw_rating: float
    fuel_rate_l_hr: float
    cost_per_hour: float
    co2e_kg_per_hr: float
    g_co2e_per_kwh: float
    noise_db_at_7m: Optional[float]
    emissions_standard: Optional[str]


class CompareResponse(BaseModel):
    load_pct: float
    fuel_price_per_liter: float
    generators: list[GeneratorMetrics]
    winner_by_efficiency: int   # generator_id with best g_co2e_per_kwh
    winner_by_cost: int         # generator_id with lowest cost_per_hour
