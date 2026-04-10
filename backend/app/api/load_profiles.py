from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.load_profile import LoadProfile
from app.schemas.load_profile import LoadProfileCreate, LoadProfileRead

router = APIRouter()


@router.get("", response_model=list[LoadProfileRead])
def list_load_profiles(sector: str | None = None, db: Session = Depends(get_db)):
    q = db.query(LoadProfile)
    if sector:
        q = q.filter(LoadProfile.sector == sector)
    return q.order_by(LoadProfile.is_preset.desc(), LoadProfile.name).all()


@router.get("/{profile_id}", response_model=LoadProfileRead)
def get_load_profile(profile_id: int, db: Session = Depends(get_db)):
    p = db.get(LoadProfile, profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Load profile not found")
    return p


@router.post("", response_model=LoadProfileRead, status_code=201)
def create_load_profile(payload: LoadProfileCreate, db: Session = Depends(get_db)):
    kw = payload.hourly_kw
    peak = max(kw)
    avg = sum(kw) / 24
    profile = LoadProfile(
        **payload.model_dump(),
        is_preset=False,
        peak_kw=peak,
        avg_kw=round(avg, 2),
        load_factor=round(avg / peak, 3) if peak > 0 else 0,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}", status_code=204)
def delete_load_profile(profile_id: int, db: Session = Depends(get_db)):
    p = db.get(LoadProfile, profile_id)
    if not p:
        raise HTTPException(status_code=404, detail="Load profile not found")
    if p.is_preset:
        raise HTTPException(status_code=403, detail="Cannot delete a preset profile")
    db.delete(p)
    db.commit()
