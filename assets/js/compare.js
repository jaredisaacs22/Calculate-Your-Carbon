/**
 * compare.js — Generator Comparison Tool
 */

let allGenerators = [];
let fuelCurveChart = null;
const CHART_COLORS = ['#2D6A4F', '#E76F51', '#3A86FF', '#8338EC'];

async function init() {
  setDropdownLoading(true);
  try {
    allGenerators = await getGenerators();
    populateDropdowns();
    await restoreFromURL();
  } catch (e) {
    showError('Could not load generator list. The API may be starting up — please refresh in 30 seconds.');
  } finally {
    setDropdownLoading(false);
  }
}

function setDropdownLoading(on) {
  document.querySelectorAll('.gen-select').forEach(sel => {
    sel.disabled = on;
    if (on) {
      sel.innerHTML = '<option>Loading generators…</option>';
    }
  });
}

function populateDropdowns() {
  const selects = document.querySelectorAll('.gen-select');
  selects.forEach((sel, idx) => {
    sel.innerHTML = idx === 0 || idx === 1
      ? '<option value="">— Select generator —</option>'
      : '<option value="">— Optional —</option>';
    const byOEM = {};
    allGenerators.forEach(g => { (byOEM[g.oem] = byOEM[g.oem] || []).push(g); });
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

async function restoreFromURL() {
  const params = new URLSearchParams(location.search);
  if (params.get('session')) {
    try {
      const session = await getComparison(params.get('session'));
      const ids = session.generator_ids;
      document.querySelectorAll('.gen-select').forEach((sel, i) => { if (ids[i]) sel.value = ids[i]; });
      document.getElementById('load-slider').value = session.load_pct;
      document.getElementById('fuel-price').value = session.fuel_price_per_liter;
      updateLoadDisplay();
      if (session.results_cache) renderResults(session.results_cache);
      return;
    } catch (e) { /* session expired — fall through */ }
  }
  if (params.get('ids')) {
    params.get('ids').split(',').forEach((id, i) => {
      const sel = document.querySelectorAll('.gen-select')[i];
      if (sel) sel.value = id;
    });
  }
  if (params.get('load')) document.getElementById('load-slider').value = params.get('load');
  if (params.get('fuel')) document.getElementById('fuel-price').value = params.get('fuel');
  updateLoadDisplay();
}

function updateLoadDisplay() {
  document.getElementById('load-display').textContent = document.getElementById('load-slider').value + '%';
}

async function runComparison() {
  const ids = [...document.querySelectorAll('.gen-select')]
    .map(s => parseInt(s.value)).filter(v => !isNaN(v));
  if (ids.length < 2) { showError('Select at least 2 generators to compare.'); return; }

  const loadPct = parseFloat(document.getElementById('load-slider').value);
  const fuelPrice = parseFloat(document.getElementById('fuel-price').value) || 1.35;

  setLoading(true);
  try {
    const result = await compareGenerators(ids, loadPct, fuelPrice);
    renderResults(result);

    // Save session in background — don't let it block or break comparison display
    saveComparison({ generator_ids: ids, load_pct: loadPct, fuel_price_per_liter: fuelPrice })
      .then(session => session?.session_uuid && setShareURL(session.session_uuid))
      .catch(() => {}); // non-fatal
  } catch (e) {
    showError('Comparison failed: ' + e.message);
  } finally {
    setLoading(false);
  }
}

function setShareURL(uuid) {
  const url = new URL(location);
  url.searchParams.delete('ids');
  url.searchParams.delete('load');
  url.searchParams.delete('fuel');
  url.searchParams.set('session', uuid);
  history.replaceState(null, '', url);
  const btn = document.getElementById('share-btn');
  if (btn) {
    btn.hidden = false;
    btn.onclick = () => navigator.clipboard.writeText(url.toString()).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy link'; }, 2000);
    });
  }
}

function renderResults(result) {
  document.getElementById('results').hidden = false;
  const cardsEl = document.getElementById('result-cards');
  cardsEl.innerHTML = '';
  result.generators.forEach((g, i) => {
    const winEff = result.winner_by_efficiency ??
      result.generators.reduce((a, b) => a.g_co2e_per_kwh < b.g_co2e_per_kwh ? a : b).generator_id;
    const winCost = result.winner_by_cost ??
      result.generators.reduce((a, b) => a.cost_per_hour < b.cost_per_hour ? a : b).generator_id;
    const badges = [
      g.generator_id === winEff ? '<div class="compare-card__badge compare-card__badge--efficiency">Most efficient</div>' : '',
      g.generator_id === winCost ? '<div class="compare-card__badge compare-card__badge--cost">Lowest cost</div>' : '',
    ].join('');
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
      </dl>${badges}`;
    cardsEl.appendChild(card);
  });
  renderFuelCurveChart(result.generators.map(g => g.generator_id));
}

async function renderFuelCurveChart(genIds) {
  try {
    const curves = await Promise.all(genIds.map(id => getFuelCurve(id)));
    const labels = curves[0].interpolated.map(pt => pt.load_pct + '%');
    const datasets = curves.map((curve, i) => ({
      label: `${curve.oem} ${curve.model}`,
      data: curve.interpolated.map(pt => pt.consumption_l_hr),
      borderColor: CHART_COLORS[i],
      backgroundColor: CHART_COLORS[i] + '22',
      tension: 0.3, fill: false, pointRadius: 2,
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
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} L/hr` } },
        },
        scales: {
          y: { title: { display: true, text: 'Fuel (L/hr)' } },
          x: { title: { display: true, text: 'Load' } },
        },
      },
    });
    const optEl = document.getElementById('optimal-load-info');
    if (optEl) {
      optEl.innerHTML = curves.map((c, i) =>
        `<span style="color:${CHART_COLORS[i]}">&#9632;</span> ${c.oem} ${c.model}: best efficiency at <strong>${c.optimal_load_pct}% load</strong>`
      ).join('<br>');
    }
  } catch (e) { /* chart is non-fatal */ }
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 8000);
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
  document.getElementById('hamburger')?.addEventListener('click', function () {
    document.getElementById('mobileNav').classList.toggle('is-open');
    this.setAttribute('aria-expanded', this.getAttribute('aria-expanded') === 'false' ? 'true' : 'false');
  });
  document.getElementById('mobileClose')?.addEventListener('click', function () {
    document.getElementById('mobileNav').classList.remove('is-open');
    document.getElementById('hamburger').setAttribute('aria-expanded', 'false');
  });
});
