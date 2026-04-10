from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class LoadProfileBase(BaseModel):
    name: str
    sector: str
    description: Optional[str] = None
    hourly_kw: list[float]

    @field_validator("hourly_kw")
    @classmethod
    def must_be_24_hours(cls, v):
        if len(v) != 24:
            raise ValueError("hourly_kw must contain exactly 24 values (one per hour)")
        if any(x < 0 for x in v):
            raise ValueError("kW values must be non-negative")
        return v


class LoadProfileCreate(LoadProfileBase):
    pass


class LoadProfileRead(LoadProfileBase):
    id: int
    is_preset: bool
    peak_kw: Optional[float] = None
    avg_kw: Optional[float] = None
    load_factor: Optional[float] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
