"""
Seed script — run once on first startup (Dockerfile CMD handles this).
Idempotent: skips if presets already exist.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal, engine, Base
from app.models.load_profile import LoadProfile
from app.models.bess import BESSSystem
from app.models.generator import Generator

Base.metadata.create_all(bind=engine)

# ──────────────────────────────────────────────
# Pre-built load profiles (24-element hourly kW arrays)
# ──────────────────────────────────────────────
PRESET_PROFILES = [
    {
        "name": "Construction Site — Light",
        "sector": "construction",
        "description": "Small residential or light commercial job site. Tools, lighting, office trailer. "
                       "Active only during working hours (6 am–6 pm).",
        "hourly_kw": [
            5, 4, 4, 4, 5, 8, 15, 22, 28, 30, 32, 30,
            25, 28, 30, 32, 28, 20, 15, 10, 8, 6, 5, 5
        ],
    },
    {
        "name": "Construction Site — Heavy",
        "sector": "construction",
        "description": "Large civil, mining, or infrastructure project. Cranes, pumps, welding, flood lights.",
        "hourly_kw": [
            8, 6, 6, 6, 8, 15, 35, 55, 75, 85, 90, 82,
            70, 78, 85, 88, 75, 55, 40, 25, 18, 12, 10, 8
        ],
    },
    {
        "name": "Concert / Festival",
        "sector": "events",
        "description": "Outdoor music festival. Load builds through the day, peaks during headliner set "
                       "(8–10 pm), drops sharply after.",
        "hourly_kw": [
            5, 5, 5, 5, 5, 8, 15, 25, 35, 45, 50, 55,
            50, 45, 40, 55, 70, 85, 95, 100, 90, 75, 45, 15
        ],
    },
    {
        "name": "Film / TV Production Set",
        "sector": "events",
        "description": "Location film or TV shoot. High lighting and HMI load during shooting hours, "
                       "minimal overnight.",
        "hourly_kw": [
            0, 0, 0, 0, 5, 15, 40, 65, 75, 80, 85, 80,
            70, 75, 80, 82, 75, 60, 40, 25, 15, 8, 5, 0
        ],
    },
    {
        "name": "Telecom Tower — 24hr Base Load",
        "sector": "telecom",
        "description": "Remote cell tower or microwave relay. Near-constant load with slight daytime bump "
                       "from cooling and higher traffic.",
        "hourly_kw": [
            12, 12, 12, 12, 12, 13, 14, 15, 16, 16, 15, 15,
            15, 15, 15, 16, 16, 16, 15, 14, 13, 13, 12, 12
        ],
    },
    {
        "name": "Oil & Gas Wellhead",
        "sector": "oil_gas",
        "description": "Pumping unit and associated instrumentation. Cyclical motor loads with a consistent "
                       "base for controls and heating.",
        "hourly_kw": [
            20, 20, 20, 20, 30, 35, 45, 50, 55, 60, 55, 50,
            45, 50, 55, 60, 55, 50, 40, 35, 30, 25, 22, 20
        ],
    },
    {
        "name": "Edge Data Center",
        "sector": "industrial",
        "description": "Small colocation or edge compute facility. High load factor driven by servers "
                       "and cooling infrastructure.",
        "hourly_kw": [
            72, 70, 70, 70, 71, 72, 74, 76, 78, 80, 80, 79,
            78, 79, 80, 80, 79, 78, 77, 76, 75, 74, 73, 72
        ],
    },
    {
        "name": "Hospital — Critical Power",
        "sector": "industrial",
        "description": "Hospital or healthcare facility on backup / prime power. Operating theaters, "
                       "HVAC, and ICU drives peak load. Load never drops to zero.",
        "hourly_kw": [
            55, 52, 50, 50, 52, 58, 68, 78, 88, 95, 98, 100,
            96, 92, 95, 98, 100, 97, 90, 82, 75, 68, 62, 58
        ],
    },
]

# ──────────────────────────────────────────────
# Representative BESS units (based on publicly available rental/mobile specs)
# ──────────────────────────────────────────────
PRESET_BESS = [
    {
        "manufacturer": "Atlas Copco",
        "model": "ZBP 100",
        "capacity_kwh": 100.0,
        "power_kw": 60.0,
        "round_trip_efficiency": 0.92,
        "min_soc": 0.20,
        "max_soc": 0.95,
        "chemistry": "LFP",
        "container_type": "pallet / skid",
        "weight_kg": 1100.0,
        "dimensions_mm": {"L": 2200, "W": 1000, "H": 1200},
        "source_url": "https://www.atlascopco.com/en/power-technique/zero-emission/battery-energy-storage",
    },
    {
        "manufacturer": "Aggreko",
        "model": "BESS 200",
        "capacity_kwh": 200.0,
        "power_kw": 100.0,
        "round_trip_efficiency": 0.93,
        "min_soc": 0.20,
        "max_soc": 0.95,
        "chemistry": "LFP",
        "container_type": "20ft ISO container",
        "weight_kg": 4800.0,
        "dimensions_mm": {"L": 6058, "W": 2438, "H": 2591},
        "source_url": "https://www.aggreko.com/en-us/products/energy-storage/",
    },
    {
        "manufacturer": "Aggreko",
        "model": "BESS 500",
        "capacity_kwh": 500.0,
        "power_kw": 250.0,
        "round_trip_efficiency": 0.93,
        "min_soc": 0.20,
        "max_soc": 0.95,
        "chemistry": "LFP",
        "container_type": "20ft ISO container",
        "weight_kg": 9500.0,
        "dimensions_mm": {"L": 6058, "W": 2438, "H": 2591},
        "source_url": "https://www.aggreko.com/en-us/products/energy-storage/",
    },
    {
        "manufacturer": "Himoinsa",
        "model": "HYB-BESS 150",
        "capacity_kwh": 150.0,
        "power_kw": 75.0,
        "round_trip_efficiency": 0.91,
        "min_soc": 0.20,
        "max_soc": 0.95,
        "chemistry": "LFP",
        "container_type": "trailer-mounted",
        "weight_kg": 3200.0,
        "dimensions_mm": {"L": 4500, "W": 2100, "H": 2200},
        "source_url": "https://www.himoinsa.com/en/products/hybrid/",
    },
]

# ──────────────────────────────────────────────
# Seed generator reference data
# Representative rental generators (Atlas Copco QAS series, Aggreko, Himoinsa)
# Fuel consumption data sourced from published spec sheets
# ──────────────────────────────────────────────
PRESET_GENERATORS = [
    # Atlas Copco QAS Series (Stage V / Tier 4 Final diesel)
    {
        "oem": "Atlas Copco",
        "model": "QAS 14",
        "kw_rating": 11.0,
        "kva_rating": 14.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 0.9, "50": 1.5, "75": 2.1, "100": 2.8},
        "emissions_data": {"NOx_g_kwh": 3.5, "PM_g_kwh": 0.04, "CO2_g_kwh": 660},
        "noise_db_at_7m": 65.0,
        "emissions_standard": "EU Stage V",
        "weight_kg": 450.0,
        "dimensions_mm": {"L": 1500, "W": 650, "H": 1050},
        "source_url": "https://www.atlascopco.com/en/generators/products/diesel-generators/qas-14",
    },
    {
        "oem": "Atlas Copco",
        "model": "QAS 60",
        "kw_rating": 48.0,
        "kva_rating": 60.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 3.2, "50": 5.8, "75": 8.1, "100": 10.9},
        "emissions_data": {"NOx_g_kwh": 3.5, "PM_g_kwh": 0.04, "CO2_g_kwh": 668},
        "noise_db_at_7m": 67.0,
        "emissions_standard": "EU Stage V",
        "weight_kg": 1250.0,
        "dimensions_mm": {"L": 2830, "W": 1000, "H": 1500},
        "source_url": "https://www.atlascopco.com/en/generators/products/diesel-generators/qas-60",
    },
    {
        "oem": "Atlas Copco",
        "model": "QAS 100",
        "kw_rating": 80.0,
        "kva_rating": 100.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 5.0, "50": 9.0, "75": 13.2, "100": 17.5},
        "emissions_data": {"NOx_g_kwh": 3.5, "PM_g_kwh": 0.04, "CO2_g_kwh": 672},
        "noise_db_at_7m": 67.0,
        "emissions_standard": "EU Stage V",
        "weight_kg": 1700.0,
        "dimensions_mm": {"L": 3200, "W": 1100, "H": 1600},
        "source_url": "https://www.atlascopco.com/en/generators/products/diesel-generators/qas-100",
    },
    {
        "oem": "Atlas Copco",
        "model": "QAS 200",
        "kw_rating": 160.0,
        "kva_rating": 200.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 9.8, "50": 17.6, "75": 26.0, "100": 34.5},
        "emissions_data": {"NOx_g_kwh": 3.4, "PM_g_kwh": 0.03, "CO2_g_kwh": 668},
        "noise_db_at_7m": 70.0,
        "emissions_standard": "EU Stage V",
        "weight_kg": 3200.0,
        "dimensions_mm": {"L": 4000, "W": 1550, "H": 1900},
        "source_url": "https://www.atlascopco.com/en/generators/products/diesel-generators/qas-200",
    },
    {
        "oem": "Atlas Copco",
        "model": "QAS 500",
        "kw_rating": 400.0,
        "kva_rating": 500.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 23.0, "50": 41.5, "75": 62.0, "100": 82.5},
        "emissions_data": {"NOx_g_kwh": 3.3, "PM_g_kwh": 0.02, "CO2_g_kwh": 660},
        "noise_db_at_7m": 75.0,
        "emissions_standard": "EU Stage V",
        "weight_kg": 7200.0,
        "dimensions_mm": {"L": 5200, "W": 2200, "H": 2500},
        "source_url": "https://www.atlascopco.com/en/generators/products/diesel-generators/qas-500",
    },
    # Aggreko Diesel Fleet
    {
        "oem": "Aggreko",
        "model": "60 kVA Diesel",
        "kw_rating": 48.0,
        "kva_rating": 60.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 3.4, "50": 5.9, "75": 8.4, "100": 11.2},
        "emissions_data": {"NOx_g_kwh": 4.0, "PM_g_kwh": 0.05, "CO2_g_kwh": 675},
        "noise_db_at_7m": 68.0,
        "emissions_standard": "EPA Tier 4 Final",
        "weight_kg": 1300.0,
        "dimensions_mm": {"L": 2900, "W": 1050, "H": 1520},
        "source_url": "https://www.aggreko.com/en-us/products/power-generators/diesel-generators/",
    },
    {
        "oem": "Aggreko",
        "model": "100 kVA Diesel",
        "kw_rating": 80.0,
        "kva_rating": 100.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 5.2, "50": 9.3, "75": 13.8, "100": 18.2},
        "emissions_data": {"NOx_g_kwh": 4.0, "PM_g_kwh": 0.05, "CO2_g_kwh": 672},
        "noise_db_at_7m": 70.0,
        "emissions_standard": "EPA Tier 4 Final",
        "weight_kg": 1800.0,
        "dimensions_mm": {"L": 3200, "W": 1150, "H": 1650},
        "source_url": "https://www.aggreko.com/en-us/products/power-generators/diesel-generators/",
    },
    {
        "oem": "Aggreko",
        "model": "200 kVA Diesel",
        "kw_rating": 160.0,
        "kva_rating": 200.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 10.2, "50": 18.4, "75": 27.2, "100": 36.0},
        "emissions_data": {"NOx_g_kwh": 3.8, "PM_g_kwh": 0.04, "CO2_g_kwh": 670},
        "noise_db_at_7m": 72.0,
        "emissions_standard": "EPA Tier 4 Final",
        "weight_kg": 3400.0,
        "dimensions_mm": {"L": 4100, "W": 1600, "H": 1950},
        "source_url": "https://www.aggreko.com/en-us/products/power-generators/diesel-generators/",
    },
    # Himoinsa Diesel
    {
        "oem": "Himoinsa",
        "model": "HYW-60 T5",
        "kw_rating": 48.0,
        "kva_rating": 60.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 3.1, "50": 5.6, "75": 8.0, "100": 10.7},
        "emissions_data": {"NOx_g_kwh": 3.6, "PM_g_kwh": 0.04, "CO2_g_kwh": 662},
        "noise_db_at_7m": 66.0,
        "emissions_standard": "EU Stage V",
        "weight_kg": 1180.0,
        "dimensions_mm": {"L": 2750, "W": 1000, "H": 1480},
        "source_url": "https://www.himoinsa.com/en/products/generating-sets/diesel-generating-sets/",
    },
    {
        "oem": "Himoinsa",
        "model": "HYW-100 T5",
        "kw_rating": 80.0,
        "kva_rating": 100.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 4.8, "50": 8.8, "75": 13.0, "100": 17.2},
        "emissions_data": {"NOx_g_kwh": 3.6, "PM_g_kwh": 0.04, "CO2_g_kwh": 665},
        "noise_db_at_7m": 68.0,
        "emissions_standard": "EU Stage V",
        "weight_kg": 1650.0,
        "dimensions_mm": {"L": 3100, "W": 1100, "H": 1580},
        "source_url": "https://www.himoinsa.com/en/products/generating-sets/diesel-generating-sets/",
    },
    {
        "oem": "Himoinsa",
        "model": "HYW-200 T5",
        "kw_rating": 160.0,
        "kva_rating": 200.0,
        "fuel_type": "diesel",
        "fuel_curve": {"25": 9.5, "50": 17.2, "75": 25.4, "100": 33.8},
        "emissions_data": {"NOx_g_kwh": 3.5, "PM_g_kwh": 0.03, "CO2_g_kwh": 660},
        "noise_db_at_7m": 70.0,
        "emissions_standard": "EU Stage V",
        "weight_kg": 3100.0,
        "dimensions_mm": {"L": 3900, "W": 1500, "H": 1850},
        "source_url": "https://www.himoinsa.com/en/products/generating-sets/diesel-generating-sets/",
    },
]


def seed():
    db = SessionLocal()
    try:
        # Seed load profiles
        existing_profiles = db.query(LoadProfile).filter_by(is_preset=True).count()
        if existing_profiles == 0:
            for p in PRESET_PROFILES:
                kw = p["hourly_kw"]
                peak = max(kw)
                avg = sum(kw) / len(kw)
                profile = LoadProfile(
                    name=p["name"],
                    sector=p["sector"],
                    description=p.get("description"),
                    is_preset=True,
                    hourly_kw=kw,
                    peak_kw=peak,
                    avg_kw=round(avg, 2),
                    load_factor=round(avg / peak, 3) if peak > 0 else 0,
                )
                db.add(profile)
            print(f"Seeded {len(PRESET_PROFILES)} load profiles.")
        else:
            print("Load profiles already seeded — skipping.")

        # Seed BESS systems
        existing_bess = db.query(BESSSystem).count()
        if existing_bess == 0:
            for b in PRESET_BESS:
                db.add(BESSSystem(**b))
            print(f"Seeded {len(PRESET_BESS)} BESS systems.")
        else:
            print("BESS systems already seeded — skipping.")

        # Seed generators
        existing_gens = db.query(Generator).count()
        if existing_gens == 0:
            for g in PRESET_GENERATORS:
                db.add(Generator(**g))
            print(f"Seeded {len(PRESET_GENERATORS)} generators.")
        else:
            print("Generators already seeded — skipping.")

        db.commit()
        print("Seed complete.")
    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
