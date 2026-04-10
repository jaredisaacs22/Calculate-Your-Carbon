from sqlalchemy import Column, Integer, String, Float, JSON, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class LoadProfile(Base):
    __tablename__ = "load_profiles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)

    # "construction" | "events" | "telecom" | "industrial" | "oil_gas" | "custom"
    sector = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_preset = Column(Boolean, default=False, nullable=False)

    # 24-element array — kW demand for hours 0–23
    # e.g. [5, 4, 4, 4, 5, 8, 15, 22, 28, 30, 32, 30, 25, 28, 30, 32, 28, 20, 15, 10, 8, 6, 5, 5]
    hourly_kw = Column(JSON, nullable=False)

    # Derived metrics stored for fast querying
    peak_kw = Column(Float, nullable=True)
    avg_kw = Column(Float, nullable=True)
    load_factor = Column(Float, nullable=True)   # avg_kw / peak_kw

    created_at = Column(DateTime, server_default=func.now())
