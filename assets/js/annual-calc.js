/* ============================================================
   Annual Footprint Calculator Logic — /calculate/annual.html
   ============================================================ */

(function() {
  'use strict';

  const CC = window.CarbonCalc;

  // ── State ────────────────────────────────────────────────────
  const inputs = {
    // Home Energy
    state: 'TX',
    monthly_kwh: 0,
    monthly_bill: 0,
    heating_fuel: 'none',
    monthly_heating: 0,
    home_size: 0,
    has_solar: false,
    solar_kwh_offset: 0,

    // Transportation
    has_vehicle: false,
    vehicle_type: 'gasoline',
    annual_miles: 0,
    mpg: 28,
    transit_level: 'never',
    short_flights: 0,
    medium_flights: 0,
    long_flights: 0,
    cabin_class: 'economy',

    // Diet
    diet_type: 'omnivore',
    beef_frequency: 'sometimes',
    food_waste: 'avg',
    shops_local: 'sometimes',

    // Shopping & Waste
    clothing_spend: 0,
    electronics_spend: 0,
    furniture_spend: 0,
    recycles: 'yes',
    composts: 'no'
  };

  let currentStep = 1;
  const totalSteps = 4;

  // ── DOM ──────────────────────────────────────────────────────
  const steps = document.querySelectorAll('.annual-step');
  const progressSteps = document.querySelectorAll('.progress-step');
  const nextBtn = document.getElementById('next-btn');
  const backBtn2 = document.getElementById('back-btn-2');
  const calcBtn = document.getElementById('calc-annual-btn');
  const resultsSection = document.getElementById('results-section');
  const formSection = document.getElementById('form-section');

  // ── Step Navigation ───────────────────────────────────────────
  function showStep(n) {
    steps.forEach((s, i) => {
      s.classList.toggle('active', i + 1 === n);
      s.style.display = (i + 1 === n) ? 'block' : 'none';
    });
    progressSteps.forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i + 1 < n)  s.classList.add('done');
      if (i + 1 === n) s.classList.add('active');
    });
    currentStep = n;

    nextBtn.style.display = n < totalSteps ? 'inline-flex' : 'none';
    backBtn2.style.display = n > 1 ? 'inline-flex' : 'none';
    calcBtn.style.display = n === totalSteps ? 'inline-flex' : 'none';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      collectStep(currentStep);
      if (currentStep < totalSteps) showStep(currentStep + 1);
    });
  }

  if (backBtn2) {
    backBtn2.addEventListener('click', () => {
      if (currentStep > 1) showStep(currentStep - 1);
    });
  }

  if (calcBtn) {
    calcBtn.addEventListener('click', () => {
      collectStep(currentStep);
      calculateAnnual();
    });
  }

  // ── Collect Inputs Per Step ───────────────────────────────────
  function collectStep(step) {
    if (step === 1) {
      inputs.state = val('an-state') || 'TX';
      inputs.monthly_kwh = num('an-kwh');
      inputs.monthly_bill = num('an-bill');
      inputs.heating_fuel = val('an-heating-fuel') || 'none';
      inputs.monthly_heating = num('an-heating-amount');
      inputs.home_size = num('an-home-size');
      inputs.has_solar = document.getElementById('an-solar')?.value === 'yes';
      inputs.solar_kwh_offset = num('an-solar-offset');
    }
    if (step === 2) {
      inputs.has_vehicle = document.getElementById('an-has-vehicle')?.value === 'yes';
      inputs.vehicle_type = val('an-vehicle-type') || 'gasoline';
      inputs.annual_miles = num('an-miles');
      inputs.mpg = num('an-mpg') || 28;
      inputs.transit_level = val('an-transit') || 'never';
      inputs.short_flights = num('an-short-flights');
      inputs.medium_flights = num('an-medium-flights');
      inputs.long_flights = num('an-long-flights');
      inputs.cabin_class = val('an-cabin') || 'economy';
    }
    if (step === 3) {
      inputs.diet_type = val('an-diet') || 'omnivore';
      inputs.beef_frequency = val('an-beef') || 'sometimes';
      inputs.food_waste = val('an-food-waste') || 'avg';
      inputs.shops_local = val('an-local') || 'sometimes';
    }
    if (step === 4) {
      inputs.clothing_spend = num('an-clothing');
      inputs.electronics_spend = num('an-electronics');
      inputs.furniture_spend = num('an-furniture');
      inputs.recycles = val('an-recycles') || 'yes';
      inputs.composts = val('an-composts') || 'no';
    }
  }

  function val(id) {
    return document.getElementById(id)?.value || '';
  }
  function num(id) {
    return parseFloat(document.getElementById(id)?.value) || 0;
  }

  // ── Main Calculation ──────────────────────────────────────────
  function calculateAnnual() {
    // — Home Energy —
    let kwh = inputs.monthly_kwh;
    if (!kwh && inputs.monthly_bill) kwh = CC.estimateKwhFromBill(inputs.monthly_bill);
    if (inputs.has_solar) kwh = Math.max(0, kwh - inputs.solar_kwh_offset);

    const elecLbs = CC.calcElectricity(kwh, inputs.state);

    let heatingLbs = 0;
    if (inputs.heating_fuel === 'natural_gas')  heatingLbs = CC.calcNaturalGas(inputs.monthly_heating);
    if (inputs.heating_fuel === 'heating_oil')  heatingLbs = CC.calcHeatingOil(inputs.monthly_heating * 12);
    if (inputs.heating_fuel === 'propane')       heatingLbs = CC.calcPropane(inputs.monthly_heating * 12);
    if (inputs.heating_fuel === 'electric')      heatingLbs = CC.calcElectricity(inputs.monthly_heating, inputs.state);

    const homeLbs = elecLbs + heatingLbs;

    // — Transportation —
    let drivingLbs = 0;
    if (inputs.has_vehicle) {
      drivingLbs = CC.calcDriving(inputs.annual_miles, inputs.vehicle_type, inputs.mpg, inputs.state);
    }

    const shortFlightLbs  = CC.calcFlights(inputs.short_flights,  'short',  inputs.cabin_class);
    const medFlightLbs    = CC.calcFlights(inputs.medium_flights, 'medium', inputs.cabin_class);
    const longFlightLbs   = CC.calcFlights(inputs.long_flights,   'long',   inputs.cabin_class);
    const flightLbs = shortFlightLbs + medFlightLbs + longFlightLbs;

    // Transit savings (rough)
    let transitCredit = 0;
    if (inputs.transit_level === 'often') transitCredit = 1200;
    else if (inputs.transit_level === 'sometimes') transitCredit = 400;

    const transportLbs = Math.max(0, drivingLbs + flightLbs - transitCredit);

    // — Diet —
    let dietLbs = CC.calcDiet(inputs.diet_type);

    // Beef frequency adjustment
    const beefAdj = { daily: 1.3, few_per_week: 1.1, rarely: 0.85, never: 0.7 };
    if (['meat_heavy', 'omnivore'].includes(inputs.diet_type)) {
      dietLbs *= (beefAdj[inputs.beef_frequency] || 1.0);
    }

    // Food waste
    if (inputs.food_waste === 'high') dietLbs *= 1.15;
    if (inputs.food_waste === 'low') dietLbs *= 0.9;

    // — Shopping & Waste —
    const goodsLbs = CC.calcGoods({
      clothing:    inputs.clothing_spend,
      electronics: inputs.electronics_spend,
      furniture:   inputs.furniture_spend
    });

    let wasteSavings = 0;
    if (inputs.recycles === 'yes')  wasteSavings += CC.RECYCLING_ANNUAL_SAVINGS_LBS;
    if (inputs.recycles === 'sometimes') wasteSavings += CC.RECYCLING_ANNUAL_SAVINGS_LBS * 0.5;
    if (inputs.composts === 'yes') wasteSavings += CC.COMPOSTING_ANNUAL_SAVINGS_LBS;

    const wasteLbs = Math.max(0, 550 - wasteSavings); // baseline US avg waste footprint

    // — Totals —
    const totalLbs = homeLbs + transportLbs + dietLbs + goodsLbs + wasteLbs;
    const totalTons = CC.lbsToTons(totalLbs);

    const breakdown = {
      home:      { lbs: homeLbs,      label: 'Home Energy' },
      transport: { lbs: transportLbs, label: 'Transportation' },
      diet:      { lbs: dietLbs,      label: 'Food & Diet' },
      goods:     { lbs: goodsLbs + wasteLbs, label: 'Goods & Waste' }
    };

    displayResults(totalTons, totalLbs, breakdown);
  }

  // ── Display Results ───────────────────────────────────────────
  function displayResults(totalTons, totalLbs, breakdown) {
    formSection.style.display = 'none';
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });

    const level = CC.getFootprintLevel(totalTons);
    const equiv = CC.getEquivalencies(totalLbs);
    const usAvgTons = CC.US_AVERAGES.total_annual_tons;
    const pctOfAvg = ((totalTons / usAvgTons) * 100).toFixed(0);

    // Hero number
    document.getElementById('r-total-tons').textContent = CC.fmt(totalTons, 1);
    document.getElementById('r-total-tons').className = `result-number result-${level}`;

    // Level badge
    const levelLabels = { ok: 'Below Average', mid: 'About Average', warn: 'Above Average' };
    const badge = document.getElementById('r-level-badge');
    badge.textContent = levelLabels[level];
    badge.className = `badge badge-${level}`;

    // vs US avg bar
    const bar = document.getElementById('r-avg-bar-fill');
    bar.style.width = Math.min(100, pctOfAvg) + '%';
    bar.className = `compare-bar__fill compare-bar__fill-${level}`;
    document.getElementById('r-avg-label').textContent =
      `${CC.fmt(totalTons, 1)} tons — you're at ${pctOfAvg}% of the US average (${usAvgTons} tons)`;

    // Breakdown bars
    const breakdownEl = document.getElementById('r-breakdown');
    const totalForPct = Object.values(breakdown).reduce((s,b) => s + b.lbs, 0) || 1;
    breakdownEl.innerHTML = Object.entries(breakdown).map(([key, b]) => {
      const pct = ((b.lbs / totalForPct) * 100).toFixed(1);
      const tons = CC.lbsToTons(b.lbs).toFixed(2);
      return `
        <div style="margin-bottom: var(--space-4);">
          <div style="display:flex; justify-content:space-between; font-size:var(--text-sm); margin-bottom:4px;">
            <span style="font-weight:500;">${b.label}</span>
            <span style="color:var(--color-muted);">${tons} tons (${pct}%)</span>
          </div>
          <div class="compare-bar">
            <div class="compare-bar__fill compare-bar__fill-${CC.getFootprintLevel(CC.lbsToTons(b.lbs) * 2)}"
                 style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');

    // Equivalencies
    document.getElementById('r-equiv').innerHTML = `
      <div class="grid-2" style="gap:var(--space-4);">
        <div class="kpi-card">
          <div class="kpi-value">${CC.fmt(equiv.miles)}</div>
          <div class="kpi-label">miles driven in avg car</div>
          <div class="kpi-source">Source: EPA Equivalencies</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${equiv.treesYears}</div>
          <div class="kpi-label">tree-years to absorb</div>
          <div class="kpi-source">Source: EPA Equivalencies</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${CC.fmt(equiv.smartphones)}</div>
          <div class="kpi-label">smartphones charged</div>
          <div class="kpi-source">Source: EPA Equivalencies</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${equiv.gallonsGas}</div>
          <div class="kpi-label">gallons of gasoline burned</div>
          <div class="kpi-source">Source: EPA Equivalencies</div>
        </div>
      </div>
    `;

    // Ranked actions
    const actions = CC.getRankedActions(inputs);
    const actionsEl = document.getElementById('r-actions');
    if (actions.length === 0) {
      actionsEl.innerHTML = '<p class="text-muted">You\'re already doing great! Consider exploring our pre-planning tool for more ideas.</p>';
    } else {
      actionsEl.innerHTML = actions.map((a, i) => `
        <div class="action-card">
          <div class="action-card__rank">${i + 1}</div>
          <div class="action-card__body">
            <h3>${a.title}</h3>
            <p class="action-card__savings">Saves ~${CC.fmt(a.savings)} lbs CO₂e/year</p>
            <p class="action-card__meta">
              Difficulty: ${a.difficulty} &nbsp;·&nbsp; ${a.costNote}
              ${a.link ? `&nbsp;·&nbsp; <a href="${a.link}" style="color:var(--color-accent)">Learn more →</a>` : ''}
            </p>
          </div>
        </div>
      `).join('');
    }

    // Share text
    const shareText = CC.generateShareText(totalTons);
    document.getElementById('r-share-text').value = shareText;

    // Show appropriate alert
    let alertHtml = '';
    if (level === 'ok') {
      alertHtml = `<div class="alert alert-ok">Your footprint is below the US average. ${CC.fmt(usAvgTons - totalTons, 1)} tons below — keep it up! Consider exploring how to get to the Paris Agreement target of under 2 tons.</div>`;
    } else if (level === 'mid') {
      alertHtml = `<div class="alert alert-mid">Your footprint is near the US average of ${usAvgTons} tons. Small changes in transport and diet can make a meaningful difference.</div>`;
    } else {
      alertHtml = `<div class="alert alert-warn">Your footprint is above the US average. The actions below are ranked by the biggest savings — starting with just one could significantly reduce your impact.</div>`;
    }
    document.getElementById('r-alert').innerHTML = alertHtml;
  }

  // ── Share ────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    if (e.target.id === 'copy-share') {
      const textarea = document.getElementById('r-share-text');
      navigator.clipboard.writeText(textarea.value).then(() => {
        e.target.textContent = 'Copied!';
        setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
      });
    }
    if (e.target.id === 'share-twitter') {
      const text = document.getElementById('r-share-text')?.value || '';
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    }
    if (e.target.id === 'recalc-btn') {
      document.getElementById('results-section').style.display = 'none';
      document.getElementById('form-section').style.display = 'block';
      showStep(1);
    }
  });

  // Dynamic: show/hide vehicle fields
  document.addEventListener('change', (e) => {
    if (e.target.id === 'an-has-vehicle') {
      const show = e.target.value === 'yes';
      document.getElementById('vehicle-fields')?.style.setProperty('display', show ? 'block' : 'none');
    }
    if (e.target.id === 'an-solar') {
      const show = e.target.value === 'yes';
      document.getElementById('solar-offset-field')?.style.setProperty('display', show ? 'block' : 'none');
    }
  });

  // Initialize
  showStep(1);

})();
