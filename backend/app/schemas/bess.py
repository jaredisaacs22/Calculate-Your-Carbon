from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class BESSBase(BaseModel):
    manufacturer: str
    model: str
    capacity_kwh: float
    power_kw: float
    round_trip_efficiency: float = 0.92
    min_soc: float = 0.20
    max_soc: float = 0.95
    dimensions_mm: Optional[dict] = None
    weight_kg: Optional[float] = None
    chemistry: Optional[str] = None
    container_type: Optional[str] = None
    source_url: Optional[str] = None


class BESSCreate(BESSBase):
    pass


class BESSRead(BESSBase):
    id: int
    is_active: bool
    scraped_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
