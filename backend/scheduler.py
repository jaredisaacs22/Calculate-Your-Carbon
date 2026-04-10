"""
APScheduler — weekly OEM re-scrape.
Run as a separate process or imported by main.py on startup.
"""
import asyncio
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger


def _scrape_all_sync():
    """Synchronous wrapper for the async scrape pipeline."""
    from app.api.admin import _run_scrape
    db_url = os.getenv("DATABASE_URL", "")
    loop = asyncio.new_event_loop()
    for oem in ["atlas_copco", "aggreko", "himoinsa"]:
        try:
            loop.run_until_complete(_run_scrape(oem, db_url))
        except Exception as e:
            print(f"[Scheduler] {oem} error: {e}")
    loop.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _scrape_all_sync,
        trigger=IntervalTrigger(weeks=1),
        id="weekly_scrape",
        replace_existing=True,
    )
    scheduler.start()
    print("[Scheduler] Weekly OEM scrape job registered.")
    return scheduler


if __name__ == "__main__":
    import time
    s = start_scheduler()
    print("Scheduler running. Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        s.shutdown()
