import uuid
from sqlalchemy import Column, Integer, String, Float, JSON, DateTime
from sqlalchemy.sql import func
from app.database import Base


class ComparisonSession(Base):
    __tablename__ = "comparison_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_uuid = Column(String(36), nullable=False, unique=True, index=True,
                          default=lambda: str(uuid.uuid4()))

    # Input parameters stored for replay / sharing
    generator_ids = Column(JSON, nullable=False)        # [1, 4, 7]
    load_pct = Column(Float, nullable=False)
    fuel_price_per_liter = Column(Float, nullable=False, default=1.35)

    # Cached result JSON (avoids re-computing on GET)
    results_cache = Column(JSON, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
