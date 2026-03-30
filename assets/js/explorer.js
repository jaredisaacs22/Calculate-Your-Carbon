/* ============================================================
   Pre-Planning Explorer Logic — /explore.html
   ============================================================ */

(function() {
  'use strict';

  const CC = window.CarbonCalc;

  let currentDecisionType = null;

  const decisionCards = document.querySelectorAll('.decision-card');
  const step1 = document.getElementById('exp-step-1');
  const step2 = document.getElementById('exp-step-2');
  const compareArea = document.getElementById('compare-inputs');
  const resultArea = document.getElementById('exp-result');
  const compareBtn = document.getElementById('compare-btn');
  const backBtn = document.getElementById('exp-back-btn');

  // Decision type configs
  const decisionTypes = {
    travel: {
      label: '🚗 Getting There',
      buildInputs: buildTravelInputs,
      calc: calcTravel
    },
    food: {
      label: '🍽️ What to Eat',
      buildInputs: buildFoodInputs,
      calc: calcFood
    },
    home: {
      label: '🏠 Home Decision',
      buildInputs: buildHomeInputs,
      calc: calcHome
    },
    purchase: {
      label: '🛒 What to Buy',
      buildInputs: buildPurchaseInputs,
      calc: calcPurchase
    },
    trip: {
      label: '✈️ Trip Planning',
      buildInputs: buildTripInputs,
      calc: calcTrip
    }
  };

  // ── Category selection ────────────────────────────────────────
  decisionCards.forEach(card => {
    card.addEventListener('click', () => {
      currentDecisionType = card.dataset.type;
      decisionCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      const config = decisionTypes[currentDecisionType];
      if (!config) return;

      document.getElementById('exp-step2-label').textContent = config.label;
      compareArea.innerHTML = config.buildInputs();
      step1.style.display = 'none';
      step2.style.display = 'block';
      resultArea.style.display = 'none';
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Wire range sliders
      wireSliders();
    });
  });

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      step2.style.display = 'none';
      step1.style.display = 'block';
      resultArea.style.display = 'none';
      currentDecisionType = null;
      decisionCards.forEach(c => c.classList.remove('selected'));
    });
  }

  if (compareBtn) {
    compareBtn.addEventListener('click', () => {
      const config = decisionTypes[currentDecisionType];
      if (!config) return;
      const result = config.calc();
      renderResult(result);
    });
  }

  // ── Input Builders ────────────────────────────────────────────

  function buildTravelInputs() {
    return `
      <div class="vs-grid">
        <div class="card">
          <h3 style="font-weight:600;margin-bottom:var(--space-6);">Option A — Drive</h3>
          <div class="form-group">
            <label class="form-label" for="exp-dist">One-way distance (miles)</label>
            <input type="number" class="form-input" id="exp-dist" value="250" min="1">
          </div>
          <div class="form-group">
            <label class="form-label" for="exp-mpg-a">Fuel economy (MPG)</label>
            <input type="number" class="form-input" id="exp-mpg-a" value="28" min="1">
          </div>
          <div class="form-group">
            <label class="form-label" for="exp-passengers">Passengers (incl. driver)</label>
            <input type="number" class="form-input" id="exp-passengers" value="1" min="1" max="8">
          </div>
        </div>
        <div class="vs-divider">vs.</div>
        <div class="card">
          <h3 style="font-weight:600;margin-bottom:var(--space-6);">Option B — Alternative</h3>
          <div class="form-group">
            <label class="form-label" for="exp-alt-mode">Alternative mode</label>
            <select class="form-select" id="exp-alt-mode">
              <option value="amtrak">Train (Amtrak)</option>
              <option value="bus">Intercity bus (Greyhound, etc.)</option>
              <option value="fly_economy">Fly — Economy</option>
              <option value="fly_business">Fly — Business</option>
              <option value="ev_drive">Drive — Electric Vehicle</option>
              <option value="carpool_2">Drive — Carpool (2 people)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="exp-state-b">Your state (for EV)</label>
            <select class="form-select" id="exp-state-b">
              <option value="TX" selected>Texas</option>
              <option value="CA">California</option>
              <option value="WA">Washington</option>
              <option value="NY">New York</option>
              <option value="FL">Florida</option>
              <option value="OH">Ohio</option>
              <option value="CO">Colorado</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="exp-trips-per-year">Times per year?</label>
            <input type="number" class="form-input" id="exp-trips-per-year" value="1" min="1">
            <p class="form-hint">For annual impact calculation</p>
          </div>
        </div>
      </div>
    `;
  }

  function buildFoodInputs() {
    const foodOptions = Object.keys(CC.FOOD_FACTORS).map(k =>
      `<option value="${k}">${k.replace(/_/g,' ')}</option>`
    ).join('');

    return `
      <div class="vs-grid">
        <div class="card">
          <h3 style="font-weight:600;margin-bottom:var(--space-6);">Option A</h3>
          <div class="form-group">
            <label class="form-label" for="exp-food-a">Food item</label>
            <select class="form-select" id="exp-food-a">
              <option value="beef">Beef</option>
              ${foodOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="exp-serving-a">Serving size (grams)</label>
            <input type="number" class="form-input" id="exp-serving-a" value="200" min="10">
          </div>
        </div>
        <div class="vs-divider">vs.</div>
        <div class="card">
          <h3 style="font-weight:600;margin-bottom:var(--space-6);">Option B</h3>
          <div class="form-group">
            <label class="form-label" for="exp-food-b">Food item</label>
            <select class="form-select" id="exp-food-b">
              <option value="chicken">Chicken</option>
              ${foodOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="exp-serving-b">Serving size (grams)</label>
            <input type="number" class="form-input" id="exp-serving-b" value="200" min="10">
          </div>
        </div>
      </div>
      <div class="form-group" style="margin-top:var(--space-6);">
        <label class="form-label" for="exp-food-freq">Times per week</label>
        <input type="range" id="exp-food-freq" min="1" max="14" value="3">
        <p style="font-size:var(--text-sm);color:var(--color-muted);margin-top:var(--space-2);" id="exp-food-freq-display">3 times per week</p>
      </div>
    `;
  }

  function buildHomeInputs() {
    return `
      <div class="vs-grid">
        <div class="card">
          <h3 style="font-weight:600;margin-bottom:var(--space-6);">Option A</h3>
          <div class="form-group">
            <label class="form-label" for="exp-home-a">Current appliance/system</label>
            <select class="form-select" id="exp-home-a">
              <option value="gas_heater">Gas water heater</option>
              <option value="gas_furnace">Gas furnace (home heating)</option>
              <option value="gas_stove">Gas stove/range</option>
              <option value="window_ac">Window AC unit</option>
              <option value="incandescent">Incandescent bulbs</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="exp-home-usage-a">Annual usage (therms or kWh)</label>
            <input type="number" class="form-input" id="exp-home-usage-a" value="250">
          </div>
        </div>
        <div class="vs-divider">vs.</div>
        <div class="card">
          <h3 style="font-weight:600;margin-bottom:var(--space-6);">Option B — Upgrade</h3>
          <div class="form-group">
            <label class="form-label" for="exp-home-b">Replacement</label>
            <select class="form-select" id="exp-home-b">
              <option value="heat_pump_wh">Heat pump water heater</option>
              <option value="heat_pump_hvac">Heat pump (HVAC)</option>
              <option value="induction_stove">Induction stove</option>
              <option value="mini_split">Mini-split heat pump</option>
              <option value="led_bulbs">LED bulbs</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="exp-state-home">Your state</label>
            <select class="form-select" id="exp-state-home">
              <option value="TX" selected>Texas</option>
              <option value="CA">California</option>
              <option value="WA">Washington</option>
              <option value="NY">New York</option>
              <option value="FL">Florida</option>
              <option value="OH">Ohio</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }

  function buildPurchaseInputs() {
    return `
      <div class="vs-grid">
        <div class="card">
          <h3 style="font-weight:600;margin-bottom:var(--space-6);">Option A — New</h3>
          <div class="form-group">
            <label class="form-label" for="exp-purchase-cat">Category</label>
            <select class="form-select" id="exp-purchase-cat">
              <option value="clothing">Clothing</option>
              <option value="electronics">Electronics</option>
              <option value="furniture">Furniture</option>
              <option value="general">General retail</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="exp-purchase-price">Price ($)</label>
            <input type="number" class="form-input" id="exp-purchase-price" value="100" min="1">
          </div>
        </div>
        <div class="vs-divider">vs.</div>
        <div class="card">
          <h3 style="font-weight:600;margin-bottom:var(--space-6);">Option B — Secondhand</h3>
          <p style="color:var(--color-muted);font-size:var(--text-sm);line-height:1.7;">
            Buying secondhand avoids approximately <strong>95% of manufacturing emissions</strong> — only transport and minor refurbishment remain.
          </p>
          <div class="form-group" style="margin-top:var(--space-4);">
            <label class="form-label" for="exp-secondhand-price">Secondhand price ($)</label>
            <input type="number" class="form-input" id="exp-secondhand-price" value="35" min="0">
          </div>
        </div>
      </div>
    `;
  }

  function buildTripInputs() {
    return `
      <p style="color:var(--color-muted);margin-bottom:var(--space-6);">Compare the carbon cost of flying vs. driving vs. taking the train for a trip.</p>
      <div class="card" style="margin-bottom:var(--space-6);">
        <h3 style="font-weight:600;margin-bottom:var(--space-4);">Trip details</h3>
        <div class="grid-2" style="gap:var(--space-4);">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="exp-trip-dist">One-way distance (miles)</label>
            <input type="number" class="form-input" id="exp-trip-dist" value="500" min="1">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="exp-trip-mpg">Your car's MPG</label>
            <input type="number" class="form-input" id="exp-trip-mpg" value="28" min="1">
          </div>
        </div>
      </div>
      <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-4);">We'll compare all available modes for this trip.</p>
    `;
  }

  // ── Calculation Functions ─────────────────────────────────────

  function calcTravel() {
    const dist = parseFloat(document.getElementById('exp-dist').value) || 250;
    const mpg  = parseFloat(document.getElementById('exp-mpg-a').value) || 28;
    const pax  = parseFloat(document.getElementById('exp-passengers').value) || 1;
    const alt  = document.getElementById('exp-alt-mode').value;
    const state = document.getElementById('exp-state-b').value;
    const tripsPerYear = parseFloat(document.getElementById('exp-trips-per-year').value) || 1;

    const driveTotal = (dist / mpg) * CC.GASOLINE_FACTOR * 2; // round trip
    const drivePer = driveTotal / pax;

    let altLbs;
    let altLabel;
    switch(alt) {
      case 'amtrak':
        altLbs = dist * CC.TRANSIT_FACTORS.amtrak * 2;
        altLabel = 'Train (Amtrak)';
        break;
      case 'bus':
        altLbs = dist * CC.TRANSIT_FACTORS.bus_intercity * 2;
        altLabel = 'Intercity bus';
        break;
      case 'fly_economy':
        altLbs = CC.calcFlightByDistance(dist, 'economy', true);
        altLabel = 'Fly (economy)';
        break;
      case 'fly_business':
        altLbs = CC.calcFlightByDistance(dist, 'business', true);
        altLabel = 'Fly (business)';
        break;
      case 'ev_drive':
        altLbs = dist * 2 * CC.EV_KWH_PER_MILE * (CC.EGRID_FACTORS[state] || 0.755);
        altLabel = 'Drive (EV)';
        break;
      case 'carpool_2':
        altLbs = driveTotal / 2;
        altLabel = 'Drive (carpool ×2)';
        break;
      default:
        altLbs = 0;
        altLabel = 'Alternative';
    }

    return {
      a: { label: `Drive alone (${mpg} MPG, ${dist} mi)`, lbs: drivePer },
      b: { label: `${altLabel} (${dist} mi)`, lbs: altLbs },
      annual_a: drivePer * tripsPerYear,
      annual_b: altLbs * tripsPerYear,
      context: `Round trip, per person. ${tripsPerYear > 1 ? `Annual impact if you make this trip ${tripsPerYear}×/year shown below.` : ''}`
    };
  }

  function calcFood() {
    const foodA = document.getElementById('exp-food-a').value;
    const foodB = document.getElementById('exp-food-b').value;
    const servingA = (parseFloat(document.getElementById('exp-serving-a').value) || 200) / 1000;
    const servingB = (parseFloat(document.getElementById('exp-serving-b').value) || 200) / 1000;
    const freq = parseFloat(document.getElementById('exp-food-freq').value) || 3;

    const annualServings = freq * 52;
    const aLbs = (CC.FOOD_FACTORS[foodA] || 0) * servingA * annualServings * 2.20462;
    const bLbs = (CC.FOOD_FACTORS[foodB] || 0) * servingB * annualServings * 2.20462;

    return {
      a: { label: `${foodA.replace(/_/g,' ')} (${(servingA*1000).toFixed(0)}g, ${freq}×/week)`, lbs: aLbs / 52 },
      b: { label: `${foodB.replace(/_/g,' ')} (${(servingB*1000).toFixed(0)}g, ${freq}×/week)`, lbs: bLbs / 52 },
      annual_a: aLbs,
      annual_b: bLbs,
      context: 'Per-serving result shown. Annual impact based on frequency.'
    };
  }

  function calcHome() {
    const homeA = document.getElementById('exp-home-a').value;
    const usage = parseFloat(document.getElementById('exp-home-usage-a').value) || 250;
    const state = document.getElementById('exp-state-home').value;
    const ef = CC.EGRID_FACTORS[state] || 0.755;

    // Option A: gas appliances
    let aLbs = 0;
    if (['gas_heater','gas_furnace'].includes(homeA)) aLbs = usage * CC.NATURAL_GAS_FACTOR;
    else if (homeA === 'window_ac') aLbs = usage * ef;
    else if (homeA === 'incandescent') aLbs = usage * ef;
    else aLbs = usage * CC.NATURAL_GAS_FACTOR;

    // Option B: electric heat pump (typically 3-4× more efficient → ~70% less energy)
    const homeB = document.getElementById('exp-home-b').value;
    let bLbs = 0;
    const hpMultiplier = homeB.includes('led') ? 0.1 : 0.3; // LEDs use 90% less; heat pumps ~70% less
    bLbs = (usage * hpMultiplier) * ef; // electric equiv with heat pump efficiency

    return {
      a: { label: `${homeA.replace(/_/g,' ')} (gas/electric)`, lbs: aLbs },
      b: { label: `${homeB.replace(/_/g,' ')} (electric)`, lbs: bLbs },
      annual_a: aLbs,
      annual_b: bLbs,
      context: 'Annual operating emissions. Does not include manufacturing emissions of the new appliance.'
    };
  }

  function calcPurchase() {
    const cat = document.getElementById('exp-purchase-cat').value;
    const price = parseFloat(document.getElementById('exp-purchase-price').value) || 100;
    const secondhandPrice = parseFloat(document.getElementById('exp-secondhand-price').value) || 35;

    const factor = CC.SPENDING_FACTORS[cat] || 0.45;
    const newLbs = price * factor;
    const usedLbs = secondhandPrice * 0.05 * factor; // 5% of manufacturing emissions

    return {
      a: { label: `New ${cat} ($${price})`, lbs: newLbs },
      b: { label: `Secondhand ($${secondhandPrice})`, lbs: usedLbs },
      annual_a: newLbs,
      annual_b: usedLbs,
      context: 'Buying secondhand avoids ~95% of manufacturing emissions. Source: EPA EEIO'
    };
  }

  function calcTrip() {
    const dist = parseFloat(document.getElementById('exp-trip-dist').value) || 500;
    const mpg  = parseFloat(document.getElementById('exp-trip-mpg').value) || 28;

    const options = CC.compareTravelOptions(dist, { drive_mpg: mpg });
    // Return multi-option result
    return {
      multi: true,
      options: [
        { label: 'Drive alone', lbs: options.drive_alone, icon: '🚗' },
        { label: 'EV (avg US grid)', lbs: options.ev_drive, icon: '⚡' },
        { label: 'Carpool (×2)', lbs: options.carpool_2, icon: '👥' },
        { label: 'Fly (economy)', lbs: options.fly_economy, icon: '✈️' },
        { label: 'Train (Amtrak)', lbs: options.amtrak, icon: '🚂' },
        { label: 'Bus', lbs: options.bus, icon: '🚌' }
      ].sort((a,b) => a.lbs - b.lbs),
      context: `Round-trip comparison for a ${dist}-mile trip.`
    };
  }

  // ── Render Results ────────────────────────────────────────────

  function renderResult(result) {
    resultArea.style.display = 'block';
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (result.multi) {
      renderMultiResult(result);
      return;
    }

    const { a, b, annual_a, annual_b, context } = result;
    const winner = a.lbs <= b.lbs ? 'a' : 'b';
    const diff = Math.abs(a.lbs - b.lbs);
    const pctBetter = a.lbs > 0 ? ((diff / Math.max(a.lbs, b.lbs)) * 100).toFixed(0) : 0;
    const annualDiff = Math.abs(annual_a - annual_b);

    const maxLbs = Math.max(a.lbs, b.lbs) || 1;

    resultArea.innerHTML = `
      <h2 style="font-family:var(--font-heading);font-size:var(--text-2xl);margin-bottom:var(--space-8);">Comparison Result</h2>

      <div class="vs-grid">
        <div class="card ${winner === 'a' ? 'winner-card' : ''}" style="text-align:center;">
          ${winner === 'a' ? '<span class="badge badge-ok" style="margin-bottom:var(--space-3);">✓ Lower Carbon</span><br>' : ''}
          <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-3);">${a.label}</p>
          <div style="font-family:var(--font-heading);font-size:var(--text-4xl);color:${winner==='a'?'var(--color-ok)':'var(--color-warn)'};">${CC.fmt(a.lbs)}</div>
          <div style="color:var(--color-muted);font-size:var(--text-sm);">lbs CO₂e</div>
          <div class="compare-bar" style="margin-top:var(--space-4);">
            <div class="compare-bar__fill compare-bar__fill-${winner==='a'?'ok':'warn'}" style="width:${((a.lbs/maxLbs)*100).toFixed(0)}%"></div>
          </div>
        </div>

        <div class="vs-divider">vs.</div>

        <div class="card ${winner === 'b' ? 'winner-card' : ''}" style="text-align:center;">
          ${winner === 'b' ? '<span class="badge badge-ok" style="margin-bottom:var(--space-3);">✓ Lower Carbon</span><br>' : ''}
          <p style="font-size:var(--text-sm);color:var(--color-muted);margin-bottom:var(--space-3);">${b.label}</p>
          <div style="font-family:var(--font-heading);font-size:var(--text-4xl);color:${winner==='b'?'var(--color-ok)':'var(--color-warn)'};">${CC.fmt(b.lbs)}</div>
          <div style="color:var(--color-muted);font-size:var(--text-sm);">lbs CO₂e</div>
          <div class="compare-bar" style="margin-top:var(--space-4);">
            <div class="compare-bar__fill compare-bar__fill-${winner==='b'?'ok':'warn'}" style="width:${((b.lbs/maxLbs)*100).toFixed(0)}%"></div>
          </div>
        </div>
      </div>

      <div class="alert alert-ok" style="margin-top:var(--space-6);">
        ✅ <strong>${winner === 'a' ? 'Option A' : 'Option B'} saves ${CC.fmt(diff)} lbs CO₂e — that's ${pctBetter}% less carbon.</strong>
        ${annualDiff > 0 ? `<br>Annually: <strong>${CC.fmt(annualDiff)} lbs saved = ${CC.lbsToTons(annualDiff).toFixed(2)} tons/year</strong>` : ''}
      </div>

      <p style="color:var(--color-muted);font-size:var(--text-sm);margin-top:var(--space-4);">${context}</p>

      <div style="margin-top:var(--space-6);display:flex;gap:var(--space-4);flex-wrap:wrap;">
        <button class="btn btn-ghost" id="exp-reset">← Compare something else</button>
        <a href="/calculate/annual.html" class="btn btn-primary">Calculate full annual footprint →</a>
      </div>

      <div class="ad-unit">
        <p class="ad-label">Advertisement</p>
        <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXX" data-ad-slot="XXXXXXXXXX" data-ad-format="auto" data-full-width-responsive="true"></ins>
      </div>
    `;

    document.getElementById('exp-reset')?.addEventListener('click', resetExplorer);
  }

  function renderMultiResult(result) {
    const maxLbs = Math.max(...result.options.map(o => o.lbs)) || 1;
    const best = result.options[0];

    resultArea.innerHTML = `
      <h2 style="font-family:var(--font-heading);font-size:var(--text-2xl);margin-bottom:var(--space-4);">All Options Compared</h2>
      <p style="color:var(--color-muted);margin-bottom:var(--space-8);">${result.context}</p>

      ${result.options.map((opt, i) => `
        <div class="card" style="margin-bottom:var(--space-4);${i===0?'border-color:var(--color-ok);box-shadow:0 0 0 2px rgba(82,183,136,0.2);':''}">
          <div style="display:flex;align-items:center;gap:var(--space-4);">
            <span style="font-size:1.5rem;">${opt.icon}</span>
            <div style="flex:1;">
              <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                <span style="font-weight:500;">${opt.label}</span>
                <span style="font-family:var(--font-heading);font-size:var(--text-xl);color:${i===0?'var(--color-ok)':'var(--color-text)'};">${CC.fmt(opt.lbs)} lbs</span>
              </div>
              <div class="compare-bar">
                <div class="compare-bar__fill compare-bar__fill-${i===0?'ok':i<3?'mid':'warn'}"
                     style="width:${((opt.lbs/maxLbs)*100).toFixed(0)}%"></div>
              </div>
            </div>
            ${i===0 ? '<span class="badge badge-ok">Best</span>' : ''}
          </div>
          ${i===0 ? `<p style="font-size:var(--text-xs);color:var(--color-ok);margin-top:var(--space-2);">Saves ${CC.fmt(result.options[result.options.length-1].lbs - opt.lbs)} lbs vs. highest-emission option</p>` : ''}
        </div>
      `).join('')}

      <div style="margin-top:var(--space-6);display:flex;gap:var(--space-4);flex-wrap:wrap;">
        <button class="btn btn-ghost" id="exp-reset">← Compare something else</button>
        <a href="/calculate/annual.html" class="btn btn-primary">Calculate full annual footprint →</a>
      </div>
    `;

    document.getElementById('exp-reset')?.addEventListener('click', resetExplorer);
  }

  function resetExplorer() {
    step2.style.display = 'none';
    step1.style.display = 'block';
    resultArea.style.display = 'none';
    currentDecisionType = null;
    decisionCards.forEach(c => c.classList.remove('selected'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Slider wiring ─────────────────────────────────────────────
  function wireSliders() {
    const freqSlider = document.getElementById('exp-food-freq');
    const freqDisplay = document.getElementById('exp-food-freq-display');
    if (freqSlider && freqDisplay) {
      freqSlider.addEventListener('input', () => {
        freqDisplay.textContent = `${freqSlider.value} time${freqSlider.value > 1 ? 's' : ''} per week`;
      });
    }
  }

  // ── URL params: pre-load compare type ─────────────────────────
  const params = new URLSearchParams(window.location.search);
  const preCompare = params.get('compare');
  if (preCompare) {
    const mapCompare = {
      'ev-vs-gas': 'travel',
      'fly-vs-train': 'trip',
      'beef-vs-chicken': 'food'
    };
    const type = mapCompare[preCompare];
    if (type) {
      const card = document.querySelector(`.decision-card[data-type="${type}"]`);
      if (card) setTimeout(() => card.click(), 100);
    }
  }

})();
