/**
 * compare.js — Generator Comparison Tool
 * Calls GET /api/generators and POST /api/generators/compare
 */

let allGenerators = [];
let fuelCurveChart = null;

const CHART_COLORS = ['#2D6A4F', '#E76F51', '#3A86FF', '#8338EC'];

async function init() {
  try {
    allGenerators = await getGenerators();
    populateDropdowns();
    restoreFromURL();
  } catch (e) {
    showError('Could not load generator data. Is the API running? ' + e.message);
  }
}

function populateDropdowns() {
  const selects = document.querySelectorAll('.gen-select');
  selects.forEach(sel => {
    const placeholder = sel.querySelector('option[value=""]');
    // Group by OEM
    const byOEM = {};
    allGenerators.forEach(g => {
      (byOEM[g.oem] = byOEM[g.oem] || []).push(g);
    });
    Object.entries(byOEM).forEach(([oem, gens]) => {
      const group = document.createElement('optgroup');
      group.label = oem;
      gens.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = `${g.model} (${g.kw_rating} kW)`;
        group.appendChild(opt);
      });
      sel.appendChild(group);
    });
  });
}

function restoreFromURL() {
  const params = new URLSearchParams(location.search);
  if (params.get('ids')) {
    const ids = params.get('ids').split(',');
    const selects = document.querySelectorAll('.gen-select');
    selects.forEach((sel, i) => { if (ids[i]) sel.value = ids[i]; });
  }
  if (params.get('load')) document.getElementById('load-slider').value = params.get('load');
  if (params.get('fuel')) document.getElementById('fuel-price').value = params.get('fuel');
  updateLoadDisplay();
}

function updateLoadDisplay() {
  const v = document.getElementById('load-slider').value;
  document.getElementById('load-display').textContent = v + '%';
}

async function runComparison() {
  const selects = [...document.querySelectorAll('.gen-select')];
  const ids = selects.map(s => parseInt(s.value)).filter(v => !isNaN(v));
  if (ids.length < 2) {
    showError('Select at least 2 generators to compare.');
    return;
  }

  const loadPct = parseFloat(document.getElementById('load-slider').value);
  const fuelPrice = parseFloat(document.getElementById('fuel-price').value) || 1.35;

  setLoading(true);
  try {
    const result = await compareGenerators(ids, loadPct, fuelPrice);
    renderResults(result);

    // Update URL (shareable)
    const url = new URL(location);
    url.searchParams.set('ids', ids.join(','));
    url.searchParams.set('load', loadPct);
    url.searchParams.set('fuel', fuelPrice);
    history.replaceState(null, '', url);
  } catch (e) {
    showError('Comparison failed: ' + e.message);
  } finally {
    setLoading(false);
  }
}

function renderResults(result) {
  const container = document.getElementById('results');
  container.hidden = false;

  // Cards
  const cardsEl = document.getElementById('result-cards');
  cardsEl.innerHTML = '';
  result.generators.forEach((g, i) => {
    const card = document.createElement('div');
    card.className = 'compare-card';
    card.style.borderTopColor = CHART_COLORS[i];
    card.innerHTML = `
      <div class="compare-card__oem" style="color:${CHART_COLORS[i]}">${g.oem}</div>
      <div class="compare-card__model">${g.model}</div>
      <div class="compare-card__rating">${g.kw_rating} kW rated · ${result.load_pct}% load = ${(g.kw_rating * result.load_pct / 100).toFixed(1)} kW output</div>
      <dl class="compare-card__metrics">
        <div><dt>Fuel rate</dt><dd>${g.fuel_rate_l_hr} L/hr</dd></div>
        <div><dt>Cost/hr</dt><dd>$${g.cost_per_hour}/hr</dd></div>
        <div><dt>CO₂e/hr</dt><dd>${g.co2e_kg_per_hr} kg/hr</dd></div>
        <div><dt>gCO₂e/kWh</dt><dd>${g.g_co2e_per_kwh} g</dd></div>
        <div><dt>Noise</dt><dd>${g.noise_db_at_7m ? g.noise_db_at_7m + ' dB(A)' : '—'}</dd></div>
        <div><dt>Emissions std</dt><dd>${g.emissions_standard || '—'}</dd></div>
      </dl>`;
    cardsEl.appendChild(card);
  });

  // Fuel curve chart
  renderFuelCurveChart(ids_from_result(result));
}

function ids_from_result(result) {
  return result.generators.map(g => g.generator_id);
}

async function renderFuelCurveChart(genIds) {
  const gens = await Promise.all(genIds.map(id => getGenerator(id)));
  const labels = ['25%', '50%', '75%', '100%'];
  const datasets = gens.map((g, i) => ({
    label: `${g.oem} ${g.model}`,
    data: ['25', '50', '75', '100'].map(k => g.fuel_curve?.[k] ?? null),
    borderColor: CHART_COLORS[i],
    backgroundColor: CHART_COLORS[i] + '22',
    tension: 0.3,
    fill: false,
  }));

  const ctx = document.getElementById('fuel-curve-chart').getContext('2d');
  if (fuelCurveChart) fuelCurveChart.destroy();
  fuelCurveChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: 'Fuel Consumption vs Load (L/hr)', font: { size: 14 } },
      },
      scales: {
        y: { title: { display: true, text: 'Fuel Consumption (L/hr)' } },
        x: { title: { display: true, text: 'Load Point' } },
      },
    },
  });
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 6000);
}

function setLoading(on) {
  const btn = document.getElementById('compare-btn');
  btn.disabled = on;
  btn.textContent = on ? 'Calculating…' : 'Compare Generators';
}

document.addEventListener('DOMContentLoaded', () => {
  init();

  document.getElementById('load-slider').addEventListener('input', updateLoadDisplay);
  document.getElementById('compare-btn').addEventListener('click', runComparison);

  // Mobile nav
  document.getElementById('hamburger')?.addEventListener('click', function () {
    document.getElementById('mobileNav').classList.toggle('is-open');
    this.setAttribute('aria-expanded', this.getAttribute('aria-expanded') === 'false' ? 'true' : 'false');
  });
  document.getElementById('mobileClose')?.addEventListener('click', function () {
    document.getElementById('mobileNav').classList.remove('is-open');
    document.getElementById('hamburger').setAttribute('aria-expanded', 'false');
  });
});
