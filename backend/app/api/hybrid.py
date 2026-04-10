from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.generator import Generator
from app.models.bess import BESSSystem
from app.models.load_profile import LoadProfile
from app.schemas.hybrid import SimulationRequest
from app.calculators import hybrid_sim

router = APIRouter()


@router.post("/simulate")
def run_simulation(req: SimulationRequest, db: Session = Depends(get_db)):
    gen = db.get(Generator, req.generator_id)
    if not gen or not gen.is_active:
        raise HTTPException(status_code=404, detail="Generator not found")
    if not gen.fuel_curve:
        raise HTTPException(status_code=422, detail="Generator has no fuel curve data")

    bess = db.get(BESSSystem, req.bess_id)
    if not bess or not bess.is_active:
        raise HTTPException(status_code=404, detail="BESS system not found")

    if req.custom_hourly_kw:
        hourly_kw = req.custom_hourly_kw
    elif req.load_profile_id:
        profile = db.get(LoadProfile, req.load_profile_id)
        if not profile:
            raise HTTPException(status_code=404, detail="Load profile not found")
        hourly_kw = profile.hourly_kw
    else:
        raise HTTPException(status_code=422, detail="Provide load_profile_id or custom_hourly_kw")

    if len(hourly_kw) != 24:
        raise HTTPException(status_code=422, detail="hourly_kw must have exactly 24 values")

    # Merge user dispatch config with defaults
    d = req.dispatch or {}
    cfg = d if isinstance(d, dict) else d.model_dump()

    return hybrid_sim.simulate(
        gen_kw=gen.kw_rating,
        fuel_curve=gen.fuel_curve,
        capacity_kwh=bess.capacity_kwh,
        power_kw=bess.power_kw,
        rte=bess.round_trip_efficiency,
        min_soc=bess.min_soc,
        max_soc=bess.max_soc,
        hourly_kw=hourly_kw,
        fuel_price=req.fuel_price_per_liter,
        fuel_type=gen.fuel_type,
        target_load_pct=cfg.get("target_load_pct", hybrid_sim.DEFAULT_TARGET_LOAD_PCT),
        min_load_pct=cfg.get("min_load_pct", hybrid_sim.DEFAULT_MIN_LOAD_PCT),
        soc_low_threshold=cfg.get("soc_low_threshold", hybrid_sim.DEFAULT_SOC_LOW_THRESHOLD),
        soc_high_threshold=cfg.get("soc_high_threshold", hybrid_sim.DEFAULT_SOC_HIGH_THRESHOLD),
        consec_low_before_stop=cfg.get("consec_low_before_stop", hybrid_sim.DEFAULT_CONSEC_LOW_BEFORE_STOP),
        min_off_hours=cfg.get("min_off_hours", hybrid_sim.DEFAULT_MIN_OFF_HOURS),
    )
