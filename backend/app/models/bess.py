from sqlalchemy import Column, Integer, String, Float, JSON, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class BESSSystem(Base):
    __tablename__ = "bess_systems"

    id = Column(Integer, primary_key=True, index=True)
    manufacturer = Column(String(100), nullable=False, index=True)
    model = Column(String(200), nullable=False)

    capacity_kwh = Column(Float, nullable=False)     # Total usable energy (kWh)
    power_kw = Column(Float, nullable=False)         # Max charge/discharge rate (kW)

    # Typical range: 0.88–0.95
    round_trip_efficiency = Column(Float, nullable=False, default=0.92)

    # State-of-charge operational limits (fraction: 0.0–1.0)
    min_soc = Column(Float, nullable=False, default=0.20)
    max_soc = Column(Float, nullable=False, default=0.95)

    # Physical specs
    dimensions_mm = Column(JSON, nullable=True)   # {"L": ..., "W": ..., "H": ...}
    weight_kg = Column(Float, nullable=True)

    chemistry = Column(String(50), nullable=True)   # "LFP", "NMC", etc.
    container_type = Column(String(100), nullable=True)  # "20ft ISO", "trailer", etc.

    source_url = Column(String(500), nullable=True)
    scraped_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
