/* ============================================================
   calculateyourcarbon.com — Core Calculation Engine
   Sources: EPA eGRID 2022, EPA GHG Factors Hub, ICAO, Poore & Nemecek 2018
   ============================================================ */

/* ── 1. EPA eGRID 2022 — State Electricity Factors ────────────
   Units: lbs CO₂e per kWh
   Source: EPA eGRID 2022 Summary Tables
   ──────────────────────────────────────────────────────────── */
const EGRID_FACTORS = {
  AL: 0.793, AK: 1.225, AZ: 0.644, AR: 0.932, CA: 0.433,
  CO: 1.012, CT: 0.381, DE: 0.795, FL: 0.843, GA: 0.794,
  HI: 1.525, ID: 0.215, IL: 0.565, IN: 1.378, IA: 0.785,
  KS: 1.083, KY: 1.566, LA: 0.921, ME: 0.261, MD: 0.665,
  MA: 0.482, MI: 0.943, MN: 0.714, MS: 0.958, MO: 1.356,
  MT: 0.607, NE: 0.943, NV: 0.676, NH: 0.325, NJ: 0.373,
  NM: 1.156, NY: 0.371, NC: 0.757, ND: 1.285, OH: 1.099,
  OK: 0.893, OR: 0.246, PA: 0.728, RI: 0.624, SC: 0.617,
  SD: 0.266, TN: 0.649, TX: 0.879, UT: 1.222, VT: 0.057,
  VA: 0.638, WA: 0.153, WV: 1.817, WI: 0.916, WY: 1.691,
  DC: 0.665
};

/* ── 2. Combustion Factors ─────────────────────────────────────
   Source: EPA GHG Emission Factors Hub (Table 1 & Table 2)
   ──────────────────────────────────────────────────────────── */
const NATURAL_GAS_FACTOR = 11.7;   // lbs CO₂e per therm
const HEATING_OIL_FACTOR = 22.61;  // lbs CO₂e per gallon
const PROPANE_FACTOR     = 12.68;  // lbs CO₂e per gallon
const GASOLINE_FACTOR    = 19.60;  // lbs CO₂e per gallon
const DIESEL_FACTOR      = 22.51;  // lbs CO₂e per gallon
const EV_KWH_PER_MILE    = 0.346;  // kWh/mi (EPA average EV efficiency)

/* ── 3. Vehicle Class Average MPG ──────────────────────────────
   Source: EPA Fuel Economy Guide averages
   ──────────────────────────────────────────────────────────── */
const AVG_MPG = {
  small_car:   32,
  midsize_car: 28,
  suv:         24,
  truck:       20,
  minivan:     22,
  hybrid:      50,
  phev:        60,
  ev:          0
};

/* ── 4. Flight Emission Factors ────────────────────────────────
   Source: ICAO Carbon Emissions Calculator methodology
   Units: kg CO₂e per passenger-km (includes RFI ~2.0)
   ──────────────────────────────────────────────────────────── */
const FLIGHT_FACTORS = {
  short:  { economy: 0.255, business: 0.722, first: 0.722 }, // <3 hrs / <1,500 km
  medium: { economy: 0.195, business: 0.552, first: 0.864 }, // 3–6 hrs / 1,500–4,000 km
  long:   { economy: 0.147, business: 0.416, first: 0.650 }  // >6 hrs / >4,000 km
};

const HAUL_KM = { short: 900, medium: 2750, long: 9000 };

/* ── 5. Diet Emission Factors ──────────────────────────────────
   Source: Poore & Nemecek 2018 (Science), USDA
   Units: kg CO₂e per kg of food (lifecycle, incl. land use)
   ──────────────────────────────────────────────────────────── */
const FOOD_FACTORS = {
  beef:        99.48,
  lamb:        39.72,
  pork:        12.31,
  chicken:      9.87,
  turkey:      10.90,
  fish_farmed: 13.63,
  fish_wild:    6.00,
  eggs:         4.67,
  dairy_milk:   3.15,
  cheese:      23.88,
  tofu:         3.16,
  lentils:      0.90,
  rice:         4.45,
  vegetables:   2.00,
  fruits:       1.10
};

/* Annual CO₂e totals by diet archetype (kg/year) */
const DIET_ANNUAL_KG = {
  meat_heavy:  3300,
  omnivore:    2500,
  low_meat:    1900,
  pescatarian: 1700,
  vegetarian:  1400,
  vegan:       1100
};

/* ── 6. Waste & Recycling ──────────────────────────────────────
   Source: EPA WARM Model v15
   ──────────────────────────────────────────────────────────── */
const RECYCLING_SAVINGS = {
  aluminum:    9.13,  // tons CO₂e per ton recycled vs. landfilled
  cardboard:   3.33,
  glass:       0.26,
  plastic_PET: 1.61,
  newspaper:   1.41,
  steel:       2.79
};

const RECYCLING_ANNUAL_SAVINGS_LBS = 440;   // regular recycler
const COMPOSTING_ANNUAL_SAVINGS_LBS = 220;  // home composting

/* ── 7. Consumer Goods (Spending-Based) ────────────────────────
   Source: EPA EEIO model
   Units: lbs CO₂e per dollar spent
   ──────────────────────────────────────────────────────────── */
const SPENDING_FACTORS = {
  clothing:    0.78,
  electronics: 0.58,
  furniture:   0.43,
  food_out:    0.52,
  services:    0.34,
  general:     0.45
};

/* ── 8. Public Transit Factors ─────────────────────────────────
   Units: lbs CO₂e per passenger-mile
   ──────────────────────────────────────────────────────────── */
const TRANSIT_FACTORS = {
  amtrak:      0.15,
  bus_intercity: 0.18,
  bus_local:   0.35,
  subway_metro: 0.28,
  car_average: 0.89  // avg passenger car (28 MPG, 19.60 lbs/gal)
};

/* ── 9. US Average Benchmarks ──────────────────────────────────
   Source: EPA 2022
   ──────────────────────────────────────────────────────────── */
const US_AVERAGES = {
  total_annual_tons:        16.0,
  home_energy_tons:          4.6,
  transportation_tons:       4.7,
  diet_tons:                 2.8,
  goods_services_tons:       2.4,
  other_tons:                1.5,
  avg_annual_driving_lbs:    11400,
  avg_monthly_electricity_lbs: 1000,
  avg_flight_domestic_lbs:   1040
};

/* ── 10. EPA Greenhouse Gas Equivalencies ──────────────────────
   Source: EPA Greenhouse Gas Equivalencies Calculator
   ──────────────────────────────────────────────────────────── */
const EQUIVALENCIES = {
  // 22 MPG fleet avg (EPA) / 19.60 lbs CO₂e per gallon = 1.122 miles per lb CO₂e
  miles_driven_per_lb:        1.122,
  smartphones_charged_per_lb: 58.5,
  trees_to_absorb_per_ton:    16.5,
  gallons_gas_per_ton:        113.0,
  homes_energy_days_per_ton:  24.5
};

/* ── Calculation Functions ──────────────────────────────────── */

/**
 * Calculate electricity emissions (annual)
 * @param {number} monthlyKwh - monthly consumption in kWh
 * @param {string} state - 2-letter state code
 * @returns {number} lbs CO₂e per year
 */
function calcElectricity(monthlyKwh, state) {
  const factor = EGRID_FACTORS[state] || 0.755; // US avg fallback
  return monthlyKwh * 12 * factor;
}

/**
 * Estimate kWh from dollar amount (US avg ~$0.13/kWh)
 * @param {number} billDollars - monthly electricity bill in $
 * @returns {number} estimated kWh
 */
function estimateKwhFromBill(billDollars) {
  return billDollars / 0.13;
}

/**
 * Calculate natural gas emissions (annual)
 * @param {number} monthlyTherms
 * @returns {number} lbs CO₂e per year
 */
function calcNaturalGas(monthlyTherms) {
  return monthlyTherms * 12 * NATURAL_GAS_FACTOR;
}

/**
 * Calculate heating oil emissions (annual)
 * @param {number} annualGallons
 * @returns {number} lbs CO₂e per year
 */
function calcHeatingOil(annualGallons) {
  return annualGallons * HEATING_OIL_FACTOR;
}

/**
 * Calculate propane emissions (annual)
 * @param {number} annualGallons
 * @returns {number} lbs CO₂e per year
 */
function calcPropane(annualGallons) {
  return annualGallons * PROPANE_FACTOR;
}

/**
 * Calculate driving emissions
 * @param {number} annualMiles
 * @param {string} vehicleType - 'gasoline'|'diesel'|'hybrid'|'ev'|'phev'
 * @param {number} mpg - miles per gallon (0 for EV)
 * @param {string} state - for EV calculation
 * @returns {number} lbs CO₂e per year
 */
function calcDriving(annualMiles, vehicleType, mpg, state) {
  if (vehicleType === 'ev') {
    const factor = EGRID_FACTORS[state] || 0.755;
    return annualMiles * EV_KWH_PER_MILE * factor;
  }
  if (vehicleType === 'phev') {
    // Assume 50% electric, 50% gasoline
    const elecFactor = EGRID_FACTORS[state] || 0.755;
    const electricMiles = annualMiles * 0.5;
    const gasMiles = annualMiles * 0.5;
    return (electricMiles * EV_KWH_PER_MILE * elecFactor) +
           (gasMiles / (mpg || 60) * GASOLINE_FACTOR);
  }
  const factor = vehicleType === 'diesel' ? DIESEL_FACTOR : GASOLINE_FACTOR;
  const effectiveMpg = mpg || AVG_MPG.midsize_car;
  return (annualMiles / effectiveMpg) * factor;
}

/**
 * Calculate flight emissions
 * @param {number} numFlights - number of round trips
 * @param {'short'|'medium'|'long'} haul
 * @param {'economy'|'business'|'first'} cabin
 * @returns {number} lbs CO₂e
 */
function calcFlights(numFlights, haul, cabin) {
  const km = HAUL_KM[haul];
  const kgCO2e = km * FLIGHT_FACTORS[haul][cabin] * 2 * numFlights; // ×2 round trip
  return kgCO2e * 2.20462; // kg → lbs
}

/**
 * Calculate flight emissions from one-way distance
 * @param {number} distanceMiles - one-way distance in miles
 * @param {'economy'|'business'|'first'} cabin
 * @param {boolean} roundTrip
 * @returns {number} lbs CO₂e
 */
function calcFlightByDistance(distanceMiles, cabin, roundTrip = true) {
  const distanceKm = distanceMiles * 1.60934;
  let haul;
  if (distanceMiles < 500)       haul = 'short';
  else if (distanceMiles < 2000) haul = 'medium';
  else                           haul = 'long';
  const kgCO2e = distanceKm * FLIGHT_FACTORS[haul][cabin] * (roundTrip ? 2 : 1);
  return kgCO2e * 2.20462;
}

/**
 * Calculate diet emissions
 * @param {string} dietType - key from DIET_ANNUAL_KG
 * @returns {number} lbs CO₂e per year
 */
function calcDiet(dietType) {
  const kg = DIET_ANNUAL_KG[dietType] || DIET_ANNUAL_KG.omnivore;
  return kg * 2.20462;
}

/**
 * Calculate spending-based goods emissions
 * @param {Object} spending - { clothing, electronics, furniture }
 * @returns {number} lbs CO₂e per year
 */
function calcGoods(spending) {
  let total = 0;
  for (const [category, amount] of Object.entries(spending)) {
    const factor = SPENDING_FACTORS[category] || SPENDING_FACTORS.general;
    total += (amount || 0) * factor;
  }
  return total;
}

/**
 * Get EPA equivalencies for a given lbs CO₂e value
 * @param {number} lbsCO2e
 * @returns {Object}
 */
function getEquivalencies(lbsCO2e) {
  const tons = lbsCO2e / 2000;
  return {
    miles:       Math.round(lbsCO2e * EQUIVALENCIES.miles_driven_per_lb),
    smartphones: Math.round(lbsCO2e * EQUIVALENCIES.smartphones_charged_per_lb),
    treesYears:  (tons * EQUIVALENCIES.trees_to_absorb_per_ton).toFixed(1),
    gallonsGas:  (tons * EQUIVALENCIES.gallons_gas_per_ton).toFixed(1),
    homesDays:   (tons * EQUIVALENCIES.homes_energy_days_per_ton).toFixed(1)
  };
}

/**
 * Get color class based on annual tons CO₂e
 * @param {number} tons
 * @returns {string} 'ok'|'mid'|'warn'
 */
function getFootprintLevel(tons) {
  if (tons < 8)  return 'ok';
  if (tons <= 16) return 'mid';
  return 'warn';
}

/**
 * Format number with commas, fixed decimals
 * @param {number} n
 * @param {number} decimals
 * @returns {string}
 */
function fmt(n, decimals = 0) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Convert lbs to tons
 * @param {number} lbs
 * @returns {number}
 */
function lbsToTons(lbs) { return lbs / 2000; }

/**
 * Convert lbs to metric tonnes
 * @param {number} lbs
 * @returns {number}
 */
function lbsToMetricTons(lbs) { return lbs / 2204.62; }

/* ── Action Recommendations Engine ─────────────────────────── */

const ACTIONS = [
  {
    id: 'go_ev',
    category: 'transport',
    title: 'Switch to an Electric Vehicle',
    condition: (inputs) => inputs.vehicle_type === 'gasoline' && (inputs.annual_miles || 0) > 8000,
    savingsLbs: (inputs) => {
      const current = ((inputs.annual_miles || 0) / (inputs.mpg || 28)) * GASOLINE_FACTOR;
      const ev = (inputs.annual_miles || 0) * EV_KWH_PER_MILE * (EGRID_FACTORS[inputs.state] || 0.755);
      return Math.max(0, current - ev);
    },
    difficulty: 'Hard',
    costNote: 'Higher upfront cost, lower fuel & maintenance cost',
    link: '/explore.html?compare=ev-vs-gas'
  },
  {
    id: 'reduce_beef',
    category: 'diet',
    title: 'Cut Beef Consumption in Half',
    condition: (inputs) => ['meat_heavy', 'omnivore'].includes(inputs.diet_type),
    savingsLbs: (inputs) => {
      // Beef contributes ~40% of meat-heavy diet; ~35% of omnivore
      return inputs.diet_type === 'meat_heavy' ? 1452 : 880;
    },
    difficulty: 'Moderate',
    costNote: 'Likely saves money on groceries',
    link: '/explore.html?compare=beef-vs-chicken'
  },
  {
    id: 'green_energy',
    category: 'home',
    title: 'Switch to a Renewable Energy Plan',
    condition: (inputs) => (EGRID_FACTORS[inputs.state] || 0.755) > 0.5,
    savingsLbs: (inputs) => {
      return (inputs.monthly_kwh || 0) * 12 * (EGRID_FACTORS[inputs.state] || 0.755) * 0.85;
    },
    difficulty: 'Easy',
    costNote: 'Often same or slightly higher monthly bill',
    link: '/learn/why-electricity-has-carbon-footprint.html'
  },
  {
    id: 'one_less_long_flight',
    category: 'transport',
    title: 'Take One Fewer Long-Haul Flight This Year',
    condition: (inputs) => (inputs.long_flights || 0) > 0,
    savingsLbs: (inputs) => {
      return HAUL_KM.long * FLIGHT_FACTORS.long.economy * 2 * 2.20462;
    },
    difficulty: 'Moderate',
    costNote: 'Saves significant money',
    link: '/explore.html?compare=fly-vs-train'
  },
  {
    id: 'reduce_driving',
    category: 'transport',
    title: 'Work From Home 2 Days/Week',
    condition: (inputs) => (inputs.annual_miles || 0) > 10000 && inputs.vehicle_type !== 'ev',
    savingsLbs: (inputs) => {
      return ((inputs.annual_miles || 0) * 0.3 / (inputs.mpg || 28)) * GASOLINE_FACTOR;
    },
    difficulty: 'Moderate',
    costNote: 'Saves gas and car maintenance costs',
    link: null
  },
  {
    id: 'go_vegetarian',
    category: 'diet',
    title: 'Adopt a Vegetarian Diet',
    condition: (inputs) => ['meat_heavy', 'omnivore', 'low_meat'].includes(inputs.diet_type),
    savingsLbs: (inputs) => {
      const current = DIET_ANNUAL_KG[inputs.diet_type] * 2.20462;
      const veg = DIET_ANNUAL_KG.vegetarian * 2.20462;
      return Math.max(0, current - veg);
    },
    difficulty: 'Hard',
    costNote: 'Usually reduces grocery spending',
    link: '/learn/carbon-cost-of-food.html'
  },
  {
    id: 'upgrade_insulation',
    category: 'home',
    title: 'Add Home Insulation & Weatherization',
    condition: (inputs) => (inputs.home_size || 0) > 1500,
    savingsLbs: (inputs) => 1200,  // EPA avg savings from basic weatherization
    difficulty: 'Moderate',
    costNote: 'One-time cost, long-term savings',
    link: null
  }
];

/**
 * Get ranked action recommendations based on user inputs
 * @param {Object} inputs - collected annual calculator inputs
 * @returns {Array} top actions sorted by savings
 */
function getRankedActions(inputs) {
  return ACTIONS
    .filter(a => a.condition(inputs))
    .map(a => ({ ...a, savings: a.savingsLbs(inputs) }))
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 5);
}

/* ── Explorer / Comparison Engine ───────────────────────────── */

/**
 * Compare travel options for a given one-way distance
 * @param {number} distanceMiles - one-way miles
 * @param {Object} opts - { drive_mpg, state }
 * @returns {Object} lbs CO₂e per option (round trip)
 */
function compareTravelOptions(distanceMiles, opts = {}) {
  const mpg = opts.drive_mpg || 28;
  const state = opts.state || 'TX';
  const results = {};

  results.drive_alone  = (distanceMiles / mpg) * GASOLINE_FACTOR * 2;
  results.carpool_2    = results.drive_alone / 2;
  results.amtrak       = distanceMiles * TRANSIT_FACTORS.amtrak * 2;
  results.bus          = distanceMiles * TRANSIT_FACTORS.bus_intercity * 2;
  results.fly_economy  = calcFlightByDistance(distanceMiles, 'economy', true);
  results.fly_business = calcFlightByDistance(distanceMiles, 'business', true);
  results.ev_drive     = distanceMiles * 2 * EV_KWH_PER_MILE * (EGRID_FACTORS[state] || 0.755);

  return results;
}

/**
 * Compare two food choices
 * @param {string} foodA - key from FOOD_FACTORS
 * @param {string} foodB
 * @param {number} servingsPerWeek
 * @param {number} servingKg - default 0.2 kg
 * @returns {Object}
 */
function compareFoodOptions(foodA, foodB, servingsPerWeek, servingKg = 0.2) {
  const annualServings = servingsPerWeek * 52;
  return {
    option_a: {
      food: foodA,
      annual_lbs: (FOOD_FACTORS[foodA] || 0) * servingKg * annualServings * 2.20462
    },
    option_b: {
      food: foodB,
      annual_lbs: (FOOD_FACTORS[foodB] || 0) * servingKg * annualServings * 2.20462
    }
  };
}

/**
 * Generate shareable result text
 * @param {number} totalTons - user's annual total
 * @returns {string}
 */
function generateShareText(totalTons) {
  const comparison = totalTons < 16 ? 'below' : 'above';
  const diff = Math.abs(totalTons - 16).toFixed(1);
  return `I just calculated my carbon footprint: ${totalTons.toFixed(1)} tons CO₂e/year — ${diff} tons ${comparison} the US average. Calculate yours free at calculateyourcarbon.com 🌿`;
}

/* ── Exports (available globally in browser) ─────────────────── */
window.CarbonCalc = {
  // Data
  EGRID_FACTORS,
  FLIGHT_FACTORS,
  HAUL_KM,
  FOOD_FACTORS,
  DIET_ANNUAL_KG,
  SPENDING_FACTORS,
  TRANSIT_FACTORS,
  US_AVERAGES,
  EQUIVALENCIES,
  AVG_MPG,
  GASOLINE_FACTOR,
  DIESEL_FACTOR,
  NATURAL_GAS_FACTOR,
  HEATING_OIL_FACTOR,
  PROPANE_FACTOR,
  EV_KWH_PER_MILE,

  // Functions
  calcElectricity,
  estimateKwhFromBill,
  calcNaturalGas,
  calcHeatingOil,
  calcPropane,
  calcDriving,
  calcFlights,
  calcFlightByDistance,
  calcDiet,
  calcGoods,
  getEquivalencies,
  getFootprintLevel,
  getRankedActions,
  compareTravelOptions,
  compareFoodOptions,
  generateShareText,
  fmt,
  lbsToTons,
  lbsToMetricTons
};
