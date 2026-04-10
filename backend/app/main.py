from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.api import generators, bess, load_profiles, hybrid, admin, comparisons
# Import all models so Base.metadata.create_all picks them up
import app.models.generator          # noqa
import app.models.bess                # noqa
import app.models.load_profile        # noqa
import app.models.comparison_session  # noqa

# Create all tables (Alembic handles migrations in production; this is a safety net)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Carbon Calculator — Equipment API",
    description="Backend API for generator comparison, BESS+Gen hybrid modeling, and load profile management.",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten in production to your domain
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generators.router,   prefix="/api/generators",    tags=["Generators"])
app.include_router(bess.router,         prefix="/api/bess",          tags=["BESS Systems"])
app.include_router(load_profiles.router,prefix="/api/load-profiles", tags=["Load Profiles"])
app.include_router(comparisons.router,  prefix="/api/comparisons",   tags=["Comparison Sessions"])
app.include_router(hybrid.router,       prefix="/api/hybrid",        tags=["Hybrid Simulation"])
app.include_router(admin.router,        prefix="/api/admin",         tags=["Admin / Scrapers"])


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "carbon-calculator-api"}
