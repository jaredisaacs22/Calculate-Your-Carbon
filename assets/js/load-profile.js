/**
 * load-profile.js — Load Profile Builder
 * Draggable 24-bar chart for building and saving custom load profiles.
 */

let profileChart = null;
let currentHourlyKW = new Array(24).fill(0);
let isDragging = false;
let allProfiles = [];

const SECTOR_LABELS = {
  construction: '🏗 Construction',
  events: '🎵 Events',
  telecom: '📡 Telecom',
  oil_gas: '🛢 Oil & Gas',
  industrial: '🏭 Industrial',
  custom: '✏️ Custom',
};

async function init() {
  const params = new URLSearchParams(location.search);
  const sectorFilter = params.get('sector') || null;

  try {
    allProfiles = await getLoadProfiles(sectorFilter);
  } catch (e) {
    allProfiles = [];
    console.warn('Could not load profiles from API, using empty list:', e);
  }

  renderSectorTabs(sectorFilter);
  renderProfileGallery(allProfiles);
  initEditor();

  // Auto-load first preset profile into editor
  if (allProfiles.length > 0) loadProfileIntoEditor(allProfiles[0]);
}

function renderSectorTabs(active) {
  const tabs = document.getElementById('sector-tabs');
  const sectors = [null, 'construction', 'events', 'telecom', 'oil_gas', 'industrial'];
  tabs.innerHTML = sectors.map(s => {
    const label = s ? SECTOR_LABELS[s] : 'All';
    const activeClass = s === active ? 'sector-tab--active' : '';
    const href = s ? `?sector=${s}` : '?';
    return `<a href="${href}" class="sector-tab ${activeClass}">${label}</a>`;
  }).join('');
}

function renderProfileGallery(profiles) {
  const gallery = document.getElementById('profile-gallery');
  if (profiles.length === 0) {
    gallery.innerHTML = '<p style="color:var(--color-muted);grid-column:1/-1">No profiles found for this sector.</p>';
    return;
  }
  gallery.innerHTML = profiles.map(p => `
    <button class="profile-card" data-id="${p.id}" onclick="loadProfileById(${p.id})">
      <div class="profile-card__name">${p.name}</div>
      <div class="profile-card__sector">${SECTOR_LABELS[p.sector] || p.sector}</div>
      <div class="profile-card__stats">
        Peak: <strong>${p.peak_kw ? p.peak_kw.toFixed(0) : '—'} kW</strong>
        · Avg: <strong>${p.avg_kw ? p.avg_kw.toFixed(0) : '—'} kW</strong>
        · LF: <strong>${p.load_factor ? (p.load_factor * 100).toFixed(0) + '%' : '—'}</strong>
      </div>
    </button>
  `).join('');
}

function initEditor() {
  const ctx = document.getElementById('profile-chart').getContext('2d');
  profileChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [{
        label: 'Load (kW)',
        data: currentHourlyKW,
        backgroundColor: '#2D6A4F',
        borderColor: '#1d4d38',
        borderWidth: 1,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `${ctx.parsed.y.toFixed(1)} kW` },
        },
      },
      scales: {
        y: {
          min: 0,
          title: { display: true, text: 'kW Demand' },
          ticks: { callback: v => v + ' kW' },
        },
        x: { title: { display: true, text: 'Hour of Day' } },
      },
    },
  });

  // Drag to set bar heights
  const canvas = document.getElementById('profile-chart');
  canvas.addEventListener('mousedown', e => { isDragging = true; handleDrag(e, canvas); });
  canvas.addEventListener('mousemove', e => { if (isDragging) handleDrag(e, canvas); });
  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });

  // Touch support
  canvas.addEventListener('touchstart', e => { isDragging = true; handleDrag(e.touches[0], canvas); }, { passive: true });
  canvas.addEventListener('touchmove', e => { if (isDragging) handleDrag(e.touches[0], canvas); }, { passive: true });
  canvas.addEventListener('touchend', () => { isDragging = false; });
}

function handleDrag(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  const chartArea = profileChart.chartArea;
  if (!chartArea) return;
  if (x < chartArea.left || x > chartArea.right || y < chartArea.top || y > chartArea.bottom) return;

  const barWidth = (chartArea.right - chartArea.left) / 24;
  const hourIndex = Math.floor((x - chartArea.left) / barWidth);
  if (hourIndex < 0 || hourIndex >= 24) return;

  const maxKW = parseFloat(document.getElementById('max-kw-input').value) || 100;
  const fraction = 1 - (y - chartArea.top) / (chartArea.bottom - chartArea.top);
  const kwValue = Math.max(0, Math.min(maxKW, fraction * maxKW));

  currentHourlyKW[hourIndex] = parseFloat(kwValue.toFixed(1));
  profileChart.data.datasets[0].data = [...currentHourlyKW];
  profileChart.update('none');
  updateStats();
}

function loadProfileIntoEditor(profile) {
  currentHourlyKW = [...profile.hourly_kw];
  profileChart.data.datasets[0].data = [...currentHourlyKW];
  profileChart.update();

  document.getElementById('profile-name').value = profile.name + ' (copy)';
  document.getElementById('profile-sector').value = profile.sector;
  document.getElementById('profile-description').value = profile.description || '';
  updateStats();

  // Highlight active card
  document.querySelectorAll('.profile-card').forEach(c => c.classList.remove('profile-card--active'));
  document.querySelector(`[data-id="${profile.id}"]`)?.classList.add('profile-card--active');
}

async function loadProfileById(id) {
  try {
    const p = await getLoadProfile(id);
    loadProfileIntoEditor(p);
  } catch (e) {
    alert('Could not load profile: ' + e.message);
  }
}

function updateStats() {
  const kw = currentHourlyKW;
  const peak = Math.max(...kw);
  const avg = kw.reduce((a, b) => a + b, 0) / 24;
  const lf = peak > 0 ? avg / peak : 0;
  document.getElementById('stat-peak').textContent = peak.toFixed(1) + ' kW';
  document.getElementById('stat-avg').textContent = avg.toFixed(1) + ' kW';
  document.getElementById('stat-lf').textContent = (lf * 100).toFixed(0) + '%';
  document.getElementById('stat-energy').textContent = avg.toFixed(1) + ' kWh/hr avg · ' + (avg * 24).toFixed(0) + ' kWh/day';
}

function clearProfile() {
  currentHourlyKW = new Array(24).fill(0);
  profileChart.data.datasets[0].data = [...currentHourlyKW];
  profileChart.update();
  updateStats();
}

function flatProfile() {
  const val = parseFloat(prompt('Set all hours to (kW):', '50'));
  if (isNaN(val)) return;
  currentHourlyKW = new Array(24).fill(parseFloat(val.toFixed(1)));
  profileChart.data.datasets[0].data = [...currentHourlyKW];
  profileChart.update();
  updateStats();
}

async function saveProfile() {
  const name = document.getElementById('profile-name').value.trim();
  const sector = document.getElementById('profile-sector').value;
  const description = document.getElementById('profile-description').value.trim();

  if (!name) { alert('Enter a profile name.'); return; }
  if (currentHourlyKW.every(v => v === 0)) { alert('Profile cannot be all zeros.'); return; }

  try {
    const saved = await saveLoadProfile({ name, sector, description, hourly_kw: currentHourlyKW });
    alert(`Profile "${saved.name}" saved! You can now use it in the Hybrid Modeler.`);
    // Refresh gallery
    allProfiles = await getLoadProfiles();
    renderProfileGallery(allProfiles);
  } catch (e) {
    alert('Save failed: ' + e.message);
  }
}

function useInHybrid() {
  // Pass current profile as URL-encoded data to hybrid page
  const data = encodeURIComponent(JSON.stringify(currentHourlyKW));
  location.href = `/equipment/hybrid.html?profile=${data}`;
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
