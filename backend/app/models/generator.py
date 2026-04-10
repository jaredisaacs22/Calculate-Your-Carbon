from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, JSON, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class Generator(Base):
    __tablename__ = "generators"

    id = Column(Integer, primary_key=True, index=True)
    oem = Column(String(100), nullable=False, index=True)          # "Atlas Copco"
    model = Column(String(200), nullable=False)                    # "QAS 60"
    kw_rating = Column(Float, nullable=False)                      # Rated output kW
    kva_rating = Column(Float, nullable=True)                      # kVA rating

    # "diesel" | "natural_gas" | "propane" | "bi_fuel"
    fuel_type = Column(String(50), nullable=False, default="diesel", index=True)

    # L/hr at load points e.g. {"25": 3.2, "50": 5.8, "75": 8.1, "100": 10.9}
    fuel_curve = Column(JSON, nullable=True)

    # g/kWh values e.g. {"NOx_g_kwh": 4.5, "PM_g_kwh": 0.1, "CO2_g_kwh": 680}
    emissions_data = Column(JSON, nullable=True)

    # Physical dimensions {"L": 3200, "W": 1100, "H": 1600} in mm
    dimensions_mm = Column(JSON, nullable=True)
    weight_kg = Column(Float, nullable=True)
    noise_db_at_7m = Column(Float, nullable=True)

    # e.g. "EPA Tier 4 Final" or "EU Stage V"
    emissions_standard = Column(String(100), nullable=True)

    description = Column(Text, nullable=True)
    source_url = Column(String(500), nullable=True)
    scraped_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())
