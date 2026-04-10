from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.bess import BESSSystem
from app.schemas.bess import BESSRead

router = APIRouter()


@router.get("", response_model=list[BESSRead])
def list_bess(db: Session = Depends(get_db)):
    return (
        db.query(BESSSystem)
        .filter(BESSSystem.is_active == True)
        .order_by(BESSSystem.manufacturer, BESSSystem.capacity_kwh)
        .all()
    )


@router.get("/{bess_id}", response_model=BESSRead)
def get_bess(bess_id: int, db: Session = Depends(get_db)):
    b = db.get(BESSSystem, bess_id)
    if not b or not b.is_active:
        raise HTTPException(status_code=404, detail="BESS system not found")
    return b
