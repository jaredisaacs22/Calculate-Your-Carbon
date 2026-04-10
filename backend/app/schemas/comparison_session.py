from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class ComparisonSessionCreate(BaseModel):
    generator_ids: list[int]
    load_pct: float = 75.0
    fuel_price_per_liter: float = 1.35

    @field_validator("generator_ids")
    @classmethod
    def must_have_2_to_4(cls, v):
        if len(v) < 2 or len(v) > 4:
            raise ValueError("Provide 2–4 generator IDs")
        return v


class ComparisonSessionRead(BaseModel):
    session_uuid: str
    generator_ids: list[int]
    load_pct: float
    fuel_price_per_liter: float
    results_cache: Optional[dict] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
