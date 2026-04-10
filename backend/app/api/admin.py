"""
Admin endpoints — trigger scrapers and check scrape status.
"""
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.generator import Generator

router = APIRouter()

# In-memory scrape status tracker (resets on container restart)
_scrape_status: dict[str, dict] = {
    "atlas_copco": {"last_run": None, "status": "never", "count": 0, "error": None},
    "aggreko":     {"last_run": None, "status": "never", "count": 0, "error": None},
    "himoinsa":    {"last_run": None, "status": "never", "count": 0, "error": None},
}

SCRAPER_MAP = {
    "atlas_copco": "app.scrapers.atlas_copco.AtlasCopcoScraper",
    "aggreko":     "app.scrapers.aggreko.AggrekoScraper",
    "himoinsa":    "app.scrapers.himoinsa.HimoinsaScraper",
}


def _import_scraper(path: str):
    module_path, class_name = path.rsplit(".", 1)
    import importlib
    mod = importlib.import_module(module_path)
    return getattr(mod, class_name)


async def _run_scrape(oem_key: str, db_url: str):
    from app.database import SessionLocal
    from app.models.generator import Generator as GenModel

    _scrape_status[oem_key]["status"] = "running"
    _scrape_status[oem_key]["last_run"] = datetime.utcnow().isoformat()

    try:
        ScraperClass = _import_scraper(SCRAPER_MAP[oem_key])
        scraper = ScraperClass()
        results = await scraper.scrape_all()

        db = SessionLocal()
        count = 0
        try:
            for item in results:
                # Upsert by oem+model
                existing = (
                    db.query(GenModel)
                    .filter_by(oem=item["oem"], model=item["model"])
                    .first()
                )
                if existing:
                    for k, v in item.items():
                        setattr(existing, k, v)
                else:
                    db.add(GenModel(**item))
                count += 1
            db.commit()
        finally:
            db.close()

        _scrape_status[oem_key]["status"] = "success"
        _scrape_status[oem_key]["count"] = count
        _scrape_status[oem_key]["error"] = None
        print(f"[Admin] {oem_key} scrape complete: {count} generators upserted.")
    except Exception as e:
        _scrape_status[oem_key]["status"] = "error"
        _scrape_status[oem_key]["error"] = str(e)
        print(f"[Admin] {oem_key} scrape failed: {e}")


@router.get("/scrape/status")
def scrape_status():
    return _scrape_status


@router.post("/scrape/{oem}")
def trigger_scrape(oem: str, background_tasks: BackgroundTasks):
    if oem not in SCRAPER_MAP:
        raise HTTPException(status_code=404, detail=f"Unknown OEM '{oem}'. Valid: {list(SCRAPER_MAP)}")
    if _scrape_status[oem]["status"] == "running":
        raise HTTPException(status_code=409, detail=f"Scrape for '{oem}' already running")

    # Fire and forget in background
    import os
    db_url = os.getenv("DATABASE_URL", "")
    background_tasks.add_task(_run_scrape, oem, db_url)

    return {"message": f"Scrape started for {oem}", "status": "running"}


@router.post("/scrape/all")
def trigger_all_scrapes(background_tasks: BackgroundTasks):
    import os
    db_url = os.getenv("DATABASE_URL", "")
    started = []
    for oem in SCRAPER_MAP:
        if _scrape_status[oem]["status"] != "running":
            background_tasks.add_task(_run_scrape, oem, db_url)
            started.append(oem)
    return {"message": f"Scrapes started for: {started}"}
