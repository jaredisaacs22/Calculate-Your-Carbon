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
