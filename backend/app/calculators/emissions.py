"""
Emission factor constants and helpers.
Sources: EPA GHG Factors Hub 2024, IPCC AR6 GWP100.
"""

# kg CO2e per litre of diesel combusted (EPA AP-42 / GHG Factors Hub 2024)
_DIESEL_CO2E_KG_PER_LITER = 2.63

# kg CO2e per litre of petrol/gasoline
_GASOLINE_CO2E_KG_PER_LITER = 2.31

# kg CO2e per litre of propane (LPG)
_PROPANE_CO2E_KG_PER_LITER = 1.55

# kg CO2e per m³ of natural gas
_NATURAL_GAS_CO2E_KG_PER_M3 = 2.02


def diesel_co2e_kg_per_liter() -> float:
    return _DIESEL_CO2E_KG_PER_LITER


def fuel_co2e_kg_per_liter(fuel_type: str) -> float:
    mapping = {
        "diesel": _DIESEL_CO2E_KG_PER_LITER,
        "gasoline": _GASOLINE_CO2E_KG_PER_LITER,
        "petrol": _GASOLINE_CO2E_KG_PER_LITER,
        "propane": _PROPANE_CO2E_KG_PER_LITER,
        "natural_gas": _NATURAL_GAS_CO2E_KG_PER_M3,  # per m³ not litre
    }
    return mapping.get(fuel_type.lower(), _DIESEL_CO2E_KG_PER_LITER)


def liters_to_co2e_kg(liters: float, fuel_type: str = "diesel") -> float:
    return liters * fuel_co2e_kg_per_liter(fuel_type)
