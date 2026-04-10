import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.generator import Generator
from app.schemas.generator import GeneratorRead, CompareRequest, CompareResponse, GeneratorMetrics
from app.calculators.fuel import interpolate_fuel_rate
from app.calculators.emissions import diesel_co2e_kg_per_liter

router = APIRouter()

DIESEL_CO2E = diesel_co2e_kg_per_liter()


@router.get("", response_model=list[GeneratorRead])
def list_generators(
    oem: str | None = None,
    fuel_type: str | None = None,
    min_kw: float | None = None,
    max_kw: float | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Generator).filter(Generator.is_active == True)
    if oem:
        q = q.filter(Generator.oem.ilike(f"%{oem}%"))
    if fuel_type:
        q = q.filter(Generator.fuel_type == fuel_type)
    if min_kw is not None:
        q = q.filter(Generator.kw_rating >= min_kw)
    if max_kw is not None:
        q = q.filter(Generator.kw_rating <= max_kw)
    return q.order_by(Generator.oem, Generator.kw_rating).all()


@router.get("/search", response_model=list[GeneratorRead])
def search_generators(q: str = Query(..., min_length=2), db: Session = Depends(get_db)):
    return (
        db.query(Generator)
        .filter(Generator.is_active == True)
        .filter(
            Generator.model.ilike(f"%{q}%") | Generator.oem.ilike(f"%{q}%")
        )
        .limit(20)
        .all()
    )


@router.get("/{gen_id}", response_model=GeneratorRead)
def get_generator(gen_id: int, db: Session = Depends(get_db)):
    g = db.get(Generator, gen_id)
    if not g or not g.is_active:
        raise HTTPException(status_code=404, detail="Generator not found")
    return g


@router.get("/{gen_id}/fuel-curve")
def get_fuel_curve(gen_id: int, db: Session = Depends(get_db)):
    """
    Return the generator's fuel curve with:
    - raw OEM data points
    - interpolated curve at every 5% load (0–100) for smooth chart rendering
    - efficiency curve (kWh/L at each point)
    - optimal load point (best kWh/L)
    """
    g = db.get(Generator, gen_id)
    if not g or not g.is_active:
        raise HTTPException(status_code=404, detail="Generator not found")
    if not g.fuel_curve:
        raise HTTPException(status_code=422, detail="Generator has no fuel curve data")

    # Raw points
    raw = [
        {"load_pct": float(k), "consumption": float(v)}
        for k, v in sorted(g.fuel_curve.items(), key=lambda x: float(x[0]))
    ]

    # Interpolated at 5% steps from 0 to 100
    load_steps = list(range(0, 105, 5))
    interpolated = []
    for lp in load_steps:
        fuel = interpolate_fuel_rate(float(lp), g.fuel_curve)
        kw_out = g.kw_rating * (lp / 100.0)
        efficiency = round(kw_out / fuel, 3) if fuel > 0 and lp > 0 else 0.0
        interpolated.append({
            "load_pct": lp,
            "consumption": round(fuel, 3),
            "kw_output": round(kw_out, 2),
            "kwh_per_liter": efficiency,
            "co2e_kg_per_hr": round(fuel * DIESEL_CO2E, 3),
        })

    # Find optimal load (best kWh/L, ignore 0% point)
    best = max(interpolated[1:], key=lambda p: p["kwh_per_liter"])

    return {
        "generator_id": g.id,
        "oem": g.oem,
        "model": g.model,
        "kw_rating": g.kw_rating,
        "fuel_type": g.fuel_type,
        "fuel_unit": "L/hr",
        "raw_points": raw,
        "interpolated_curve": interpolated,
        "optimal_load_pct": best["load_pct"],
        "optimal_kwh_per_liter": best["kwh_per_liter"],
    }


@router.post("/compare", response_model=CompareResponse)
def compare_generators(req: CompareRequest, db: Session = Depends(get_db)):
    if len(req.ids) < 2 or len(req.ids) > 4:
        raise HTTPException(status_code=422, detail="Provide 2–4 generator IDs")

    results = []
    for gid in req.ids:
        gen = db.get(Generator, gid)
        if not gen or not gen.is_active:
            raise HTTPException(status_code=404, detail=f"Generator {gid} not found")

        if not gen.fuel_curve:
            raise HTTPException(status_code=422, detail=f"Generator {gid} has no fuel curve data")

        fuel_rate = interpolate_fuel_rate(req.load_pct, gen.fuel_curve)
        co2e_per_hr = fuel_rate * DIESEL_CO2E
        kw_output = gen.kw_rating * (req.load_pct / 100)
        g_co2e_per_kwh = (co2e_per_hr * 1000 / kw_output) if kw_output > 0 else 0

        results.append(GeneratorMetrics(
            generator_id=gen.id,
            oem=gen.oem,
            model=gen.model,
            kw_rating=gen.kw_rating,
            fuel_rate_l_hr=round(fuel_rate, 2),
            cost_per_hour=round(fuel_rate * req.fuel_price_per_liter, 2),
            co2e_kg_per_hr=round(co2e_per_hr, 3),
            g_co2e_per_kwh=round(g_co2e_per_kwh, 1),
            noise_db_at_7m=gen.noise_db_at_7m,
            emissions_standard=gen.emissions_standard,
        ))

    return CompareResponse(
        load_pct=req.load_pct,
        fuel_price_per_liter=req.fuel_price_per_liter,
        generators=results,
    )
