/* ============================================================
   Quick Calculator Logic — /calculate/quick.html
   ============================================================ */

(function() {
  'use strict';

  const { CarbonCalc } = window;

  // ── State ────────────────────────────────────────────────────
  let selectedCategory = null;

  // ── DOM Refs ─────────────────────────────────────────────────
  const categoryCards = document.querySelectorAll('.category-card');
  const step1 = document.getElementById('step-1');
  const step2 = document.getElementById('step-2');
  const resultPanel = document.getElementById('result-panel');
  const inputArea = document.getElementById('input-area');
  const calcBtn = document.getElementById('calc-btn');
  const backBtn = document.getElementById('back-btn');
  const resetBtn = document.getElementById('reset-btn');

  // Result DOM
  const resultNumber = document.getElementById('result-number');
  const resultUnit = document.getElementById('result-unit');
  const resultContext = document.getElementById('result-context');
  const resultCompareFill = document.getElementById('result-compare-fill');
  const resultCompareLabel = document.getElementById('result-compare-label');
  const resultMeaning = document.getElementById('result-meaning');
  const resultEquiv = document.getElementById('result-equiv');
  const actionTips = document.getElementById('action-tips');

  // ── Category Inputs Config ────────────────────────────────────
  const categoryInputs = {
    driving: {
      label: '🚗 Driving',
      fields: `
        <div class="form-group">
          <label class="form-label" for="qc-miles">Miles driven <span class="tooltip-wrap"><span class="tooltip-icon">?</span><span class="tooltip-box">Enter the total miles for this trip or time period</span></span></label>
          <input type="number" class="form-input" id="qc-miles" placeholder="e.g. 500" min="0">
        </div>
        <div class="form-group">
          <label class="form-label" for="qc-mpg">Fuel economy (MPG)</label>
          <input type="number" class="form-input" id="qc-mpg" placeholder="e.g. 28 (leave blank for average)" min="1">
          <p class="form-hint">US average is ~28 MPG</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="qc-fuel">Fuel type</label>
          <select class="form-select" id="qc-fuel">
            <option value="gasoline">Gasoline</option>
            <option value="diesel">Diesel</option>
          </select>
        </div>
      `,
      calc: () => {
        const miles = parseFloat(document.getElementById('qc-miles').value) || 0;
        const mpg   = parseFloat(document.getElementById('qc-mpg').value)   || 28;
        const fuel  = document.getElementById('qc-fuel').value;
        const factor = fuel === 'diesel' ? CarbonCalc.DIESEL_FACTOR : CarbonCalc.GASOLINE_FACTOR;
        return (miles / mpg) * factor;
      },
      meaning: (lbs) => `Driving ${CarbonCalc.fmt(document.getElementById('qc-miles').value || 0)} miles produces this much carbon — equivalent to burning ${CarbonCalc.fmt(lbs/2000*CarbonCalc.EQUIVALENCIES.gallons_gas_per_ton, 1)} gallons of gasoline.`,
      tips: ['Keep your tires properly inflated (can improve MPG by 3%)', 'Combine errands into single trips', 'Consider carpooling for regular commutes'],
      usAvgLbs: CarbonCalc.US_AVERAGES.avg_annual_driving_lbs
    },

    flying: {
      label: '✈️ Flying',
      fields: `
        <div class="form-group">
          <label class="form-label" for="qc-flight-haul">Trip length</label>
          <select class="form-select" id="qc-flight-haul">
            <option value="short">Short haul (&lt;3 hours / &lt;500 miles)</option>
            <option value="medium" selected>Medium haul (3–6 hours / 500–2,000 miles)</option>
            <option value="long">Long haul (&gt;6 hours / &gt;2,000 miles)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="qc-cabin">Cabin class</label>
          <select class="form-select" id="qc-cabin">
            <option value="economy" selected>Economy</option>
            <option value="business">Business</option>
            <option value="first">First</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="qc-round-trip">Round trip?</label>
          <select class="form-select" id="qc-round-trip">
            <option value="1" selected>Yes (×2)</option>
            <option value="0">No, one-way</option>
          </select>
        </div>
      `,
      calc: () => {
        const haul = document.getElementById('qc-flight-haul').value;
        const cabin = document.getElementById('qc-cabin').value;
        const rt = parseInt(document.getElementById('qc-round-trip').value);
        const km = CarbonCalc.HAUL_KM[haul];
        const kgCO2e = km * CarbonCalc.FLIGHT_FACTORS[haul][cabin] * (rt ? 2 : 1);
        return kgCO2e * 2.20462;
      },
      meaning: (lbs) => `Flying in economy class with radiative forcing included. Business and first class have 2–6× higher emissions per seat due to space allocation.`,
      tips: ['Choose economy class — it has the lowest per-seat emissions', 'Direct flights produce less CO₂ than connections', 'Consider trains for trips under 4 hours'],
      usAvgLbs: CarbonCalc.US_AVERAGES.avg_flight_domestic_lbs
    },

    home_energy: {
      label: '🏠 Home Energy',
      fields: `
        <div class="form-group">
          <label class="form-label" for="qc-state">Your state <span class="tooltip-wrap"><span class="tooltip-icon">?</span><span class="tooltip-box">Electricity emissions vary widely by state based on your grid's energy mix</span></span></label>
          <select class="form-select" id="qc-state">
            ${Object.entries(CarbonCalc.EGRID_FACTORS).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>`<option value="${k}">${k} (${v} lbs/kWh)</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="qc-kwh">Monthly electricity (kWh)</label>
          <input type="number" class="form-input" id="qc-kwh" placeholder="e.g. 900" min="0">
          <p class="form-hint">Find this on your bill. US average is ~900 kWh/month.</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="qc-bill-option">Or enter your monthly bill ($)</label>
          <input type="number" class="form-input" id="qc-bill" placeholder="e.g. 120 — we'll estimate kWh" min="0">
        </div>
      `,
      calc: () => {
        const state = document.getElementById('qc-state').value;
        let kwh = parseFloat(document.getElementById('qc-kwh').value);
        const bill = parseFloat(document.getElementById('qc-bill').value);
        if (!kwh && bill) kwh = CarbonCalc.estimateKwhFromBill(bill);
        return (kwh || 900) * 12 * (CarbonCalc.EGRID_FACTORS[state] || 0.755);
      },
      meaning: (lbs) => `Your electricity emissions reflect your state's grid mix. States powered mainly by coal emit 10–30× more per kWh than hydro-heavy states like Vermont or Washington.`,
      tips: ['Switch to a renewable energy plan — many utilities offer this', 'Replace incandescent bulbs with LEDs (uses 75% less energy)', 'Air-sealing and insulation reduce heating/cooling needs significantly'],
      usAvgLbs: CarbonCalc.US_AVERAGES.avg_monthly_electricity_lbs * 12
    },

    food: {
      label: '🍽️ A Meal / Food Choice',
      fields: `
        <div class="form-group">
          <label class="form-label" for="qc-food">Food item</label>
          <select class="form-select" id="qc-food">
            <option value="beef">Beef (steak, burger, etc.)</option>
            <option value="lamb">Lamb</option>
            <option value="pork">Pork</option>
            <option value="chicken">Chicken</option>
            <option value="turkey">Turkey</option>
            <option value="fish_farmed">Farmed fish (salmon, tilapia)</option>
            <option value="fish_wild">Wild-caught fish</option>
            <option value="eggs">Eggs</option>
            <option value="cheese">Cheese</option>
            <option value="dairy_milk">Dairy milk (per liter)</option>
            <option value="tofu">Tofu</option>
            <option value="lentils">Lentils</option>
            <option value="rice">Rice</option>
            <option value="vegetables">Vegetables (average)</option>
            <option value="fruits">Fruits (average)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="qc-serving">Serving size (grams)</label>
          <input type="number" class="form-input" id="qc-serving" value="200" min="1">
          <p class="form-hint">Typical protein serving: 200g. Typical vegetable: 150g.</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="qc-meals-per-week">Times per week?</label>
          <input type="number" class="form-input" id="qc-meals-per-week" value="1" min="1" max="21">
          <p class="form-hint">Optional — calculates annual impact</p>
        </div>
      `,
      calc: () => {
        const food = document.getElementById('qc-food').value;
        const grams = parseFloat(document.getElementById('qc-serving').value) || 200;
        const perWeek = parseFloat(document.getElementById('qc-meals-per-week').value) || 1;
        const kgPerServing = grams / 1000;
        const factor = CarbonCalc.FOOD_FACTORS[food] || 0;
        return factor * kgPerServing * perWeek * 52 * 2.20462; // annual
      },
      meaning: (lbs) => `This is an annual estimate based on your serving frequency. Beef emits ~99 kg CO₂e per kg — about 20× more than vegetables. Lifecycle includes land use, methane, and transport.`,
      tips: ['Reducing beef just 1 day/week saves ~330 lbs CO₂e/year', 'Choosing chicken over beef saves ~90% of emissions per serving', 'Local and seasonal produce has a smaller footprint'],
      usAvgLbs: CarbonCalc.DIET_ANNUAL_KG.omnivore * 2.20462
    },

    purchase: {
      label: '🛒 A Purchase',
      fields: `
        <div class="form-group">
          <label class="form-label" for="qc-category">Category</label>
          <select class="form-select" id="qc-category">
            <option value="clothing">Clothing & apparel</option>
            <option value="electronics">Electronics & devices</option>
            <option value="furniture">Furniture & home goods</option>
            <option value="food_out">Restaurant / takeout</option>
            <option value="services">Services (gym, subscriptions, etc.)</option>
            <option value="general">General retail purchase</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="qc-spend">Amount spent ($)</label>
          <input type="number" class="form-input" id="qc-spend" placeholder="e.g. 150" min="0">
        </div>
      `,
      calc: () => {
        const cat = document.getElementById('qc-category').value;
        const spend = parseFloat(document.getElementById('qc-spend').value) || 0;
        return spend * (CarbonCalc.SPENDING_FACTORS[cat] || 0.45);
      },
      meaning: (lbs) => `Based on EPA input-output modeling, each dollar spent on goods and services has an embedded carbon footprint from manufacturing, transport, and disposal.`,
      tips: ['Buy secondhand when possible — avoids ~95% of manufacturing emissions', 'Choose durable goods over disposables', 'Repair instead of replace'],
      usAvgLbs: 2400 * 2.20462 * 0.75  // rough annual goods average
    },

    waste: {
      label: '♻️ Waste & Recycling',
      fields: `
        <div class="form-group">
          <label class="form-label">Do you recycle regularly?</label>
          <div class="radio-group">
            <label class="radio-option"><input type="radio" name="qc-recycle" value="yes"> Yes — most materials</label>
            <label class="radio-option"><input type="radio" name="qc-recycle" value="sometimes"> Sometimes</label>
            <label class="radio-option"><input type="radio" name="qc-recycle" value="no" checked> No</label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Do you compost food scraps?</label>
          <div class="radio-group">
            <label class="radio-option"><input type="radio" name="qc-compost" value="yes"> Yes</label>
            <label class="radio-option"><input type="radio" name="qc-compost" value="no" checked> No</label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Food waste level</label>
          <select class="form-select" id="qc-food-waste">
            <option value="low">Less than average</option>
            <option value="avg" selected>About average (~30% wasted)</option>
            <option value="high">More than average</option>
          </select>
        </div>
      `,
      calc: () => {
        const recycle = document.querySelector('input[name="qc-recycle"]:checked')?.value || 'no';
        const compost = document.querySelector('input[name="qc-compost"]:checked')?.value || 'no';
        const waste = document.getElementById('qc-food-waste').value;

        // Baseline: no recycling/composting
        let savings = 0;
        if (recycle === 'yes')       savings += CarbonCalc.RECYCLING_ANNUAL_SAVINGS_LBS;
        if (recycle === 'sometimes') savings += CarbonCalc.RECYCLING_ANNUAL_SAVINGS_LBS * 0.5;
        if (compost === 'yes')       savings += CarbonCalc.COMPOSTING_ANNUAL_SAVINGS_LBS;

        // Waste surcharge
        let wasteExtra = 0;
        if (waste === 'high') wasteExtra = 220;
        else if (waste === 'avg') wasteExtra = 110;

        // Return net footprint context (savings = carbon avoided)
        return Math.max(0, wasteExtra - savings);
      },
      meaning: (lbs) => `Recycling and composting divert waste from landfills where decomposing organics release methane — a greenhouse gas 80× more potent than CO₂ over 20 years. Source: EPA WARM v15.`,
      tips: ['Recycle aluminum — it saves 9× more CO₂ than glass per ton', 'Composting diverts food from landfills, cutting methane emissions', 'Reducing food waste saves both money and carbon'],
      usAvgLbs: 110
    }
  };

  // ── Category Selection ────────────────────────────────────────
  categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      selectedCategory = card.dataset.category;
      categoryCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      showStep2();
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });

  function showStep2() {
    const config = categoryInputs[selectedCategory];
    if (!config) return;

    inputArea.innerHTML = `
      <h2 style="font-family: var(--font-heading); font-size: var(--text-2xl); margin-bottom: var(--space-6);">
        ${config.label}
      </h2>
      ${config.fields}
    `;

    step1.classList.remove('active');
    step2.classList.add('active');
    resultPanel.classList.remove('visible');
    resultPanel.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Wire radio/check interactivity
    document.querySelectorAll('.radio-option, .check-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const input = opt.querySelector('input');
        if (input) input.checked = true;
        // Toggle selected class within group
        const groupName = input?.name;
        if (groupName) {
          document.querySelectorAll(`input[name="${groupName}"]`).forEach(i => {
            i.closest('.radio-option, .check-option')?.classList.remove('selected');
          });
        }
        opt.classList.add('selected');
      });
    });
  }

  // ── Calculate ─────────────────────────────────────────────────
  if (calcBtn) {
    calcBtn.addEventListener('click', calculate);
  }

  function calculate() {
    const config = categoryInputs[selectedCategory];
    if (!config) return;

    let lbs;
    try {
      lbs = config.calc();
    } catch(e) {
      console.error(e);
      lbs = 0;
    }

    if (isNaN(lbs) || lbs < 0) lbs = 0;

    displayResult(lbs, config);
  }

  function displayResult(lbs, config) {
    const tons = CarbonCalc.lbsToTons(lbs);
    const level = CarbonCalc.getFootprintLevel(tons);
    const equiv = CarbonCalc.getEquivalencies(lbs);

    // Big number
    resultNumber.textContent = CarbonCalc.fmt(lbs);
    resultNumber.className = `result-number result-${level}`;
    resultUnit.textContent = 'lbs of CO₂e';

    // Context — for driving, miles-equiv is circular; use gallons burned instead
    if (selectedCategory === 'driving') {
      resultContext.textContent = `≈ ${CarbonCalc.fmt(tons, 2)} metric tons — equivalent to burning ${equiv.gallonsGas} gallons of gasoline`;
    } else {
      resultContext.textContent = `≈ ${CarbonCalc.fmt(tons, 2)} metric tons — like driving ${CarbonCalc.fmt(equiv.miles)} miles in an average car`;
    }

    // Compare bar vs US average for category
    const usAvg = config.usAvgLbs || CarbonCalc.US_AVERAGES.total_annual_tons * 2000;
    const pct = Math.min(100, Math.round((lbs / usAvg) * 100));
    resultCompareFill.style.width = pct + '%';
    resultCompareFill.className = `compare-bar__fill compare-bar__fill-${level}`;
    resultCompareLabel.textContent = `${pct}% of the US average for this category`;

    // Meaning
    resultMeaning.innerHTML = `<p>${config.meaning(lbs)}</p>`;

    // Equivalencies — swap "miles driven" card for "gallons burned" in driving category
    const firstCard = selectedCategory === 'driving'
      ? `<div class="kpi-card"><div class="kpi-value">${equiv.gallonsGas}</div><div class="kpi-label">gallons of gasoline burned</div></div>`
      : `<div class="kpi-card"><div class="kpi-value">${CarbonCalc.fmt(equiv.miles)}</div><div class="kpi-label">miles driven in avg car</div></div>`;
    resultEquiv.innerHTML = `
      <div class="grid-2" style="gap: var(--space-4); margin-top: var(--space-4);">
        ${firstCard}
        <div class="kpi-card">
          <div class="kpi-value">${CarbonCalc.fmt(equiv.smartphones)}</div>
          <div class="kpi-label">smartphones charged</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${equiv.treesYears}</div>
          <div class="kpi-label">tree-years to absorb</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${equiv.homesDays}</div>
          <div class="kpi-label">days of avg home energy</div>
        </div>
      </div>
      <p class="source-tag" style="margin-top: var(--space-3);">Source: EPA Greenhouse Gas Equivalencies Calculator</p>
    `;

    // Action tips
    actionTips.innerHTML = config.tips.map(t => `<li>${t}</li>`).join('');

    // Show panel
    resultPanel.style.display = 'block';
    setTimeout(() => resultPanel.classList.add('visible'), 10);
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Navigation ─────────────────────────────────────────────────
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      step2.classList.remove('active');
      step1.classList.add('active');
      resultPanel.classList.remove('visible');
      resultPanel.style.display = 'none';
      categoryCards.forEach(c => c.classList.remove('selected'));
      selectedCategory = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      step2.classList.remove('active');
      step1.classList.add('active');
      resultPanel.classList.remove('visible');
      resultPanel.style.display = 'none';
      categoryCards.forEach(c => c.classList.remove('selected'));
      selectedCategory = null;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Share button
  document.addEventListener('click', (e) => {
    if (e.target.id === 'share-btn') {
      const lbs = parseFloat(resultNumber.textContent.replace(/,/g,'')) || 0;
      const tons = CarbonCalc.lbsToTons(lbs).toFixed(2);
      const text = `I just calculated a ${tons} ton CO₂e footprint for this activity. Calculate yours free at calculateyourcarbon.com 🌿`;
      if (navigator.share) {
        navigator.share({ text, url: 'https://calculateyourcarbon.com/calculate/quick.html' });
      } else {
        navigator.clipboard.writeText(text).then(() => {
          e.target.textContent = 'Copied!';
          setTimeout(() => { e.target.textContent = 'Share Result'; }, 2000);
        });
      }
    }
  });

  // Collapsible tips
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('collapsible__trigger')) {
      e.target.classList.toggle('open');
      const body = e.target.nextElementSibling;
      if (body) body.classList.toggle('open');
    }
  });

})();
