/* ============================================================
   Dashboard Charts & KPIs — /dashboard.html
   Uses Chart.js (CDN)
   ============================================================ */

(function() {
  'use strict';

  // ── Color Palette ─────────────────────────────────────────────
  const PALETTE = {
    green:   ['#2D6A4F','#52B788','#74C69D','#95D5B2','#B7E4C7','#D8F3DC','#E9F5DB'],
    diet:    ['#E76F51','#F4A261','#E9C46A','#2A9D8F','#52B788','#2D6A4F'],
    accent:  '#2D6A4F',
    text:    '#1A1A1A',
    muted:   '#6B6B6B',
    grid:    '#E8E8E4'
  };

  const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          font: { family: 'DM Sans', size: 13 },
          color: PALETTE.text,
          padding: 16,
          boxWidth: 14
        }
      },
      tooltip: {
        bodyFont: { family: 'DM Sans' },
        titleFont: { family: 'DM Sans', weight: '600' }
      }
    },
    scales: {
      x: {
        grid: { color: PALETTE.grid },
        ticks: { font: { family: 'DM Sans', size: 12 }, color: PALETTE.muted }
      },
      y: {
        grid: { color: PALETTE.grid },
        ticks: { font: { family: 'DM Sans', size: 12 }, color: PALETTE.muted }
      }
    }
  };

  // ── 1. US Emissions by Sector — Donut ─────────────────────────
  const sectorCtx = document.getElementById('chart-sector');
  if (sectorCtx) {
    new Chart(sectorCtx, {
      type: 'doughnut',
      data: {
        labels: ['Transportation 28%', 'Electric Power 25%', 'Industry 23%',
                 'Agriculture 10%', 'Commercial 7%', 'Residential 6%', 'Other 1%'],
        datasets: [{
          data: [28, 25, 23, 10, 7, 6, 1],
          backgroundColor: PALETTE.green,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { family: 'DM Sans', size: 12 },
              color: PALETTE.text,
              padding: 12,
              boxWidth: 14
            }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label} — ${ctx.raw}% of total US emissions`
            }
          }
        }
      }
    });
  }

  // ── 2. Personal Footprint by Category — Horizontal Bar ────────
  const personalCtx = document.getElementById('chart-personal');
  if (personalCtx) {
    new Chart(personalCtx, {
      type: 'bar',
      data: {
        labels: ['Transportation', 'Home Energy', 'Food & Diet', 'Goods & Services', 'Other'],
        datasets: [{
          label: 'Tons CO₂e/year (US Average)',
          data: [4.7, 4.6, 2.8, 2.4, 1.5],
          backgroundColor: PALETTE.green[0],
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        indexAxis: 'y',
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} tons CO₂e/year`
            }
          }
        },
        scales: {
          x: {
            ...CHART_DEFAULTS.scales.x,
            title: { display: true, text: 'Tons CO₂e/year', font: { family: 'DM Sans', size: 12 }, color: PALETTE.muted }
          },
          y: { ...CHART_DEFAULTS.scales.y, grid: { display: false } }
        }
      }
    });
  }

  // ── 3. Diet Comparison — Bar Chart ────────────────────────────
  const dietCtx = document.getElementById('chart-diet');
  if (dietCtx) {
    new Chart(dietCtx, {
      type: 'bar',
      data: {
        labels: ['Meat-Heavy', 'Omnivore', 'Low-Meat', 'Pescatarian', 'Vegetarian', 'Vegan'],
        datasets: [{
          label: 'Annual kg CO₂e per person',
          data: [3300, 2500, 1900, 1700, 1400, 1100],
          backgroundColor: PALETTE.diet,
          borderRadius: 6,
          borderSkipped: false
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw.toLocaleString()} kg CO₂e/year`
            }
          }
        },
        scales: {
          ...CHART_DEFAULTS.scales,
          y: {
            ...CHART_DEFAULTS.scales.y,
            title: { display: true, text: 'kg CO₂e per person per year', font: { family: 'DM Sans', size: 12 }, color: PALETTE.muted }
          }
        }
      }
    });
  }

  // ── 4. US Emissions Trend — Line Chart ────────────────────────
  const trendCtx = document.getElementById('chart-trend');
  if (trendCtx) {
    new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: [2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022],
        datasets: [{
          label: 'US Total GHG Emissions (billion tons CO₂e)',
          data: [7.38,7.37,7.38,7.07,6.66,6.87,6.79,6.55,6.67,6.73,6.59,6.51,6.46,6.68,6.56,5.74,6.10,5.56],
          borderColor: PALETTE.accent,
          backgroundColor: 'rgba(45,106,79,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: PALETTE.accent,
          pointHoverRadius: 6
        }]
      },
      options: {
        ...CHART_DEFAULTS,
        plugins: {
          ...CHART_DEFAULTS.plugins,
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} billion tons CO₂e`
            }
          },
          annotation: {
            annotations: {
              crisis2008: {
                type: 'line',
                xMin: '2008', xMax: '2008',
                borderColor: 'rgba(231,111,81,0.4)',
                borderWidth: 2,
                borderDash: [4, 4],
                label: { content: 'Financial Crisis', display: true, position: 'start' }
              },
              covid2020: {
                type: 'line',
                xMin: '2020', xMax: '2020',
                borderColor: 'rgba(231,111,81,0.4)',
                borderWidth: 2,
                borderDash: [4, 4],
                label: { content: 'COVID-19', display: true, position: 'start' }
              }
            }
          }
        },
        scales: {
          ...CHART_DEFAULTS.scales,
          y: {
            ...CHART_DEFAULTS.scales.y,
            title: { display: true, text: 'Billion tons CO₂e', font: { family: 'DM Sans', size: 12 }, color: PALETTE.muted },
            min: 5.0,
            max: 8.0
          }
        }
      }
    });
  }

  // ── 5. Equivalency Calculator (interactive widget) ────────────
  const equivInput = document.getElementById('equiv-input');
  const equivUnit  = document.getElementById('equiv-unit');
  const equivOutput = document.getElementById('equiv-output');

  function updateEquiv() {
    const val = parseFloat(equivInput?.value) || 0;
    const unit = equivUnit?.value || 'lbs';
    const lbs = unit === 'tons' ? val * 2000 : unit === 'kg' ? val * 2.20462 : val;

    if (!equivOutput) return;

    const miles = Math.round(lbs * 0.001085);
    const phones = Math.round(lbs * 58.5);
    const trees = (lbs / 2000 * 16.5).toFixed(1);
    const gallons = (lbs / 2000 * 113).toFixed(1);

    equivOutput.innerHTML = `
      <div class="grid-2" style="gap:var(--space-4);">
        <div class="kpi-card">
          <div class="kpi-value">${miles.toLocaleString()}</div>
          <div class="kpi-label">miles driven in avg passenger car</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${phones.toLocaleString()}</div>
          <div class="kpi-label">smartphones fully charged</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${trees}</div>
          <div class="kpi-label">tree-years to absorb this CO₂</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${gallons}</div>
          <div class="kpi-label">gallons of gasoline burned</div>
        </div>
      </div>
      <p class="source-tag" style="margin-top:var(--space-3);">Source: EPA Greenhouse Gas Equivalencies Calculator</p>
    `;
  }

  if (equivInput) equivInput.addEventListener('input', updateEquiv);
  if (equivUnit)  equivUnit.addEventListener('change', updateEquiv);
  updateEquiv(); // initialize

})();
