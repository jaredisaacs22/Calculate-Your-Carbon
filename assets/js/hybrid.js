/**
 * hybrid.js — BESS + Generator Hybrid Modeler
 * Calls POST /api/hybrid/simulate
 */

let hourlyKW = new Array(24).fill(50);
let loadChart = null;
let resultsChart = null;
let socChart = null;
let isDragging = false;

async function init() {
  try {
    const [gens, bessUnits, profiles] = await Promise.all([
      getGenerators(),
      getBESSSystems(),
      getLoadProfiles(),
    ]);
    populateGeneratorSelect(gens);
    populateBESSSelect(bessUnits);
    populateProfileSelect(profiles);
  } catch (e) {
    console.warn('API unavailable:', e.message);
  }

  // Pre-fill from URL if coming from load-profile builder
  const params = new URLSearchParams(location.search);
  if (params.get('profile')) {
    try {
      hourlyKW = JSON.parse(decodeURIComponent(params.get('profile')));
    } catch (_) {}
  }

  initLoadChart();
  updateLoadStats();
}

function populateGeneratorSelect(gens) {
  const sel = document.getElementById('gen-select');
  const byOEM = {};
  gens.forEach(g => { (byOEM[g.oem] = byOEM[g.oem] || []).push(g); });
  Object.entries(byOEM).forEach(([oem, gs]) => {
    const grp = document.createElement('optgroup');
    grp.label = oem;
    gs.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.model} (${g.kw_rating} kW)`;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });
}

function populateBESSSelect(bess) {
  const sel = document.getElementById('bess-select');
  bess.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = `${b.manufacturer} ${b.model} — ${b.capacity_kwh} kWh / ${b.power_kw} kW`;
    sel.appendChild(opt);
  });
}

function populateProfileSelect(profiles) {
  const sel = document.getElementById('profile-select');
  profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', async () => {
    if (!sel.value) return;
    try {
      const p = await getLoadProfile(parseInt(sel.value));
      hourlyKW = [...p.hourly_kw];
      loadChart.data.datasets[0].data = [...hourlyKW];
      loadChart.update();
      updateLoadStats();
    } catch (e) { alert('Could not load profile: ' + e.message); }
  });
}

function initLoadChart() {
  const ctx = document.getElementById('load-chart').getContext('2d');
  loadChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [{ label: 'Load (kW)', data: [...hourlyKW], backgroundColor: '#3A86FF', borderRadius: 3 }],
    },
    options: {
      responsive: true,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, title: { display: true, text: 'kW Demand' } },
        x: { title: { display: true, text: 'Hour' } },
      },
    },
  });

  const canvas = document.getElementById('load-chart');
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('mousedown', e => { isDragging = true; dragLoad(e, canvas); });
  canvas.addEventListener('mousemove', e => { if (isDragging) dragLoad(e, canvas); });
  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });
}

function dragLoad(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const area = loadChart.chartArea;
  if (!area || x < area.left || x > area.right || y < area.top || y > area.bottom) return;

  const idx = Math.floor((x - area.left) / ((area.right - area.left) / 24));
  const maxKW = parseFloat(document.getElementById('load-max-kw').value) || 200;
  const frac = 1 - (y - area.top) / (area.bottom - area.top);
  hourlyKW[Math.max(0, Math.min(23, idx))] = parseFloat(Math.max(0, Math.min(maxKW, frac * maxKW)).toFixed(1));
  loadChart.data.datasets[0].data = [...hourlyKW];
  loadChart.update('none');
  updateLoadStats();
}

function updateLoadStats() {
  const peak = Math.max(...hourlyKW);
  const avg = hourlyKW.reduce((a, b) => a + b, 0) / 24;
  document.getElementById('load-peak').textContent = peak.toFixed(0) + ' kW';
  document.getElementById('load-avg').textContent = avg.toFixed(0) + ' kW';
  document.getElementById('load-lf').textContent = peak > 0 ? (avg / peak * 100).toFixed(0) + '%' : '—';
}

async function runSimulation() {
  const genId = parseInt(document.getElementById('gen-select').value);
  const bessId = parseInt(document.getElementById('bess-select').value);
  const fuelPrice = parseFloat(document.getElementById('fuel-price').value) || 1.35;

  if (!genId) { alert('Select a generator.'); return; }
  if (!bessId) { alert('Select a BESS system.'); return; }

  setLoading(true);
  try {
    const result = await runHybridSimulation({
      generator_id: genId,
      bess_id: bessId,
      custom_hourly_kw: hourlyKW,
      fuel_price_per_liter: fuelPrice,
    });
    renderResults(result);
  } catch (e) {
    alert('Simulation failed: ' + e.message);
  } finally {
    setLoading(false);
  }
}

function renderResults(r) {
  const section = document.getElementById('results');
  section.hidden = false;
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // KPI cards
  const fmt = (n, dp = 1) => n != null ? n.toFixed(dp) : '—';
  document.getElementById('r-fuel-baseline').textContent = fmt(r.generator_only.total_fuel_liters) + ' L';
  document.getElementById('r-fuel-hybrid').textContent   = fmt(r.hybrid.total_fuel_liters) + ' L';
  document.getElementById('r-fuel-saved').textContent    = fmt(r.savings.fuel_liters) + ' L (' + fmt(r.savings.savings_pct) + '%)';
  document.getElementById('r-co2-baseline').textContent  = fmt(r.generator_only.co2e_kg) + ' kg';
  document.getElementById('r-co2-hybrid').textContent    = fmt(r.hybrid.co2e_kg) + ' kg';
  document.getElementById('r-co2-saved').textContent     = fmt(r.savings.co2e_kg) + ' kg';
  document.getElementById('r-cost-baseline').textContent = '$' + fmt(r.generator_only.fuel_cost_usd);
  document.getElementById('r-cost-hybrid').textContent   = '$' + fmt(r.hybrid.fuel_cost_usd);
  document.getElementById('r-cost-saved').textContent    = '$' + fmt(r.savings.fuel_cost_usd);
  document.getElementById('r-runtime-baseline').textContent = r.generator_only.runtime_hours + ' hrs';
  document.getElementById('r-runtime-hybrid').textContent   = r.hybrid.runtime_hours + ' hrs';
  document.getElementById('r-runtime-saved').textContent    = r.savings.runtime_reduction_hours + ' hrs saved';
  document.getElementById('r-bess-cycles').textContent = r.hybrid.bess_cycles + ' cycles';

  renderResultsCharts(r);
}

function renderResultsCharts(r) {
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  // Fuel comparison chart
  const ctx1 = document.getElementById('results-chart').getContext('2d');
  if (resultsChart) resultsChart.destroy();
  resultsChart = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: hours,
      datasets: [
        { label: 'Generator only (L/hr)', data: r.generator_only.hourly_fuel, borderColor: '#E76F51', backgroundColor: '#E76F5122', tension: 0.3, fill: true },
        { label: 'Hybrid system (L/hr)',  data: r.hybrid.hourly_fuel,         borderColor: '#2D6A4F', backgroundColor: '#2D6A4F22', tension: 0.3, fill: true },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: 'Hourly Fuel Consumption (L/hr)', font: { size: 14 } },
      },
      scales: {
        y: { min: 0, title: { display: true, text: 'L/hr' } },
        x: { title: { display: true, text: 'Hour of Day' } },
      },
    },
  });

  // BESS SOC chart
  const ctx2 = document.getElementById('soc-chart').getContext('2d');
  if (socChart) socChart.destroy();
  socChart = new Chart(ctx2, {
    type: 'line',
    data: {
      labels: hours,
      datasets: [
        { label: 'BESS State of Charge', data: r.hybrid.hourly_soc.map(v => (v * 100).toFixed(1)), borderColor: '#3A86FF', backgroundColor: '#3A86FF22', tension: 0.3, fill: true },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'BESS State of Charge (%)', font: { size: 14 } },
      },
      scales: {
        y: { min: 0, max: 100, title: { display: true, text: 'SOC (%)' }, ticks: { callback: v => v + '%' } },
        x: { title: { display: true, text: 'Hour of Day' } },
      },
    },
  });
}

function setLoading(on) {
  const btn = document.getElementById('simulate-btn');
  btn.disabled = on;
  btn.textContent = on ? 'Simulating…' : 'Run Simulation';
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  document.getElementById('hamburger')?.addEventListener('click', function () {
    document.getElementById('mobileNav').classList.toggle('is-open');
    this.setAttribute('aria-expanded', this.getAttribute('aria-expanded') === 'false' ? 'true' : 'false');
  });
  document.getElementById('mobileClose')?.addEventListener('click', function () {
    document.getElementById('mobileNav').classList.remove('is-open');
    document.getElementById('hamburger').setAttribute('aria-expanded', 'false');
  });
});
