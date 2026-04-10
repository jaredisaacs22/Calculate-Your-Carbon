import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.comparison_session import ComparisonSession
from app.models.generator import Generator
from app.schemas.comparison_session import ComparisonSessionCreate, ComparisonSessionRead
from app.calculators.fuel import interpolate_fuel_rate
from app.calculators.emissions import diesel_co2e_kg_per_liter

router = APIRouter()

DIESEL_CO2E = diesel_co2e_kg_per_liter()


def _compute_results(generator_ids: list[int], load_pct: float,
                     fuel_price: float, db: Session) -> dict:
    """Run the comparison calculation and return result dict."""
    generators = []
    for gid in generator_ids:
        gen = db.get(Generator, gid)
        if not gen or not gen.is_active:
            raise HTTPException(status_code=404, detail=f"Generator {gid} not found")
        if not gen.fuel_curve:
            raise HTTPException(status_code=422, detail=f"Generator {gid} has no fuel curve data")

        fuel_rate = interpolate_fuel_rate(load_pct, gen.fuel_curve)
        co2e_per_hr = fuel_rate * DIESEL_CO2E
        kw_output = gen.kw_rating * (load_pct / 100)
        g_co2e_per_kwh = (co2e_per_hr * 1000 / kw_output) if kw_output > 0 else 0

        generators.append({
            "generator_id": gen.id,
            "oem": gen.oem,
            "model": gen.model,
            "kw_rating": gen.kw_rating,
            "fuel_rate_l_hr": round(fuel_rate, 2),
            "cost_per_hour": round(fuel_rate * fuel_price, 2),
            "co2e_kg_per_hr": round(co2e_per_hr, 3),
            "g_co2e_per_kwh": round(g_co2e_per_kwh, 1),
            "noise_db_at_7m": gen.noise_db_at_7m,
            "emissions_standard": gen.emissions_standard,
        })

    # Identify winners
    winner_efficiency = min(generators, key=lambda g: g["g_co2e_per_kwh"])["generator_id"]
    winner_cost       = min(generators, key=lambda g: g["cost_per_hour"])["generator_id"]

    return {
        "load_pct": load_pct,
        "fuel_price_per_liter": fuel_price,
        "generators": generators,
        "winner_by_efficiency": winner_efficiency,
        "winner_by_cost": winner_cost,
    }


@router.post("", response_model=ComparisonSessionRead, status_code=201)
def create_comparison(payload: ComparisonSessionCreate, db: Session = Depends(get_db)):
    results = _compute_results(
        payload.generator_ids, payload.load_pct, payload.fuel_price_per_liter, db
    )
    session = ComparisonSession(
        session_uuid=str(uuid.uuid4()),
        generator_ids=payload.generator_ids,
        load_pct=payload.load_pct,
        fuel_price_per_liter=payload.fuel_price_per_liter,
        results_cache=results,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_uuid}", response_model=ComparisonSessionRead)
def get_comparison(session_uuid: str, db: Session = Depends(get_db)):
    session = (
        db.query(ComparisonSession)
        .filter(ComparisonSession.session_uuid == session_uuid)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Comparison session not found")
    return session
