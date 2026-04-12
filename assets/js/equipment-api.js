/**
 * equipment-api.js — Shared API client for all equipment pages.
 * Talks to FastAPI backend at /api/*
 */

const API_BASE = '/api';

// Render free tier cold-starts after ~15 min idle — retry up to 4x before giving up.
const _MAX_RETRIES = 4;
const _RETRY_DELAY_MS = 8000;

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function _fetch(path, options = {}, _attempt = 0) {
  // Show warm-up notice on first retry
  if (_attempt === 1) _showWarmingUp();

  let resp;
  try {
    resp = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  } catch (networkErr) {
    if (_attempt < _MAX_RETRIES) {
      await _sleep(_RETRY_DELAY_MS);
      return _fetch(path, options, _attempt + 1);
    }
    _hideWarmingUp();
    _showApiOffline();
    throw new Error('API unavailable — backend not reachable');
  }

  if (!resp.ok) {
    // 502/503/504 = server starting up — retry
    if ([502, 503, 504].includes(resp.status) && _attempt < _MAX_RETRIES) {
      if (_attempt === 0) _showWarmingUp();
      await _sleep(_RETRY_DELAY_MS);
      return _fetch(path, options, _attempt + 1);
    }
    _hideWarmingUp();
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }

  _hideWarmingUp();
  return resp.json();
}

function _showWarmingUp() {
  if (document.getElementById('_api-warming-banner')) return;
  const b = document.createElement('div');
  b.id = '_api-warming-banner';
  b.style.cssText = 'position:fixed;top:64px;left:0;right:0;z-index:9000;background:#856404;color:#fff;text-align:center;padding:10px 16px;font-size:14px;font-weight:600;letter-spacing:.02em';
  b.innerHTML = 'Backend starting up — this takes ~30 seconds on first load. Retrying\u2026';
  document.body.prepend(b);
}

function _hideWarmingUp() {
  const b = document.getElementById('_api-warming-banner');
  if (b) b.remove();
}

function _showApiOffline() {
  if (document.getElementById('_api-offline-banner')) return;
  const b = document.createElement('div');
  b.id = '_api-offline-banner';
  b.style.cssText = 'position:fixed;top:64px;left:0;right:0;z-index:9000;background:#BF3A2B;color:#fff;text-align:center;padding:10px 16px;font-size:14px;font-weight:600;letter-spacing:.02em';
  b.innerHTML = 'API OFFLINE — Could not reach backend after multiple retries. <a href="/methodology.html" style="color:#fff;text-decoration:underline">Learn more</a>';
  document.body.prepend(b);
}

/** List generators with optional filters { oem, fuel_type, min_kw, max_kw } */
async function getGenerators(filters = {}) {
  const params = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null))
  );
  return _fetch(`/generators?${params}`);
}

/** Get a single generator by ID */
async function getGenerator(id) {
  return _fetch(`/generators/${id}`);
}

/** Compare generators at a load point
 *  @param {number[]} ids - 2–4 generator IDs
 *  @param {number} loadPct - 25–100
 *  @param {number} fuelPrice - USD/litre
 */
async function compareGenerators(ids, loadPct, fuelPrice) {
  return _fetch('/generators/compare', {
    method: 'POST',
    body: JSON.stringify({ ids, load_pct: loadPct, fuel_price_per_liter: fuelPrice }),
  });
}

/** List BESS systems */
async function getBESSSystems() {
  return _fetch('/bess');
}

/** Get load profiles. Pass sector string to filter, or null for all. */
async function getLoadProfiles(sector = null) {
  const params = sector ? `?sector=${encodeURIComponent(sector)}` : '';
  return _fetch(`/load-profiles${params}`);
}

/** Get single load profile */
async function getLoadProfile(id) {
  return _fetch(`/load-profiles/${id}`);
}

/** Save a custom load profile */
async function saveLoadProfile({ name, sector, description, hourly_kw }) {
  return _fetch('/load-profiles', {
    method: 'POST',
    body: JSON.stringify({ name, sector, description, hourly_kw }),
  });
}

/** Get interpolated fuel curve at 5% increments for a generator */
async function getFuelCurve(id) {
  return _fetch(`/generators/${id}/fuel-curve`);
}

/** Run hybrid simulation */
async function runHybridSimulation({ generator_id, bess_id, load_profile_id, custom_hourly_kw, fuel_price_per_liter, dispatch }) {
  return _fetch('/hybrid/simulate', {
    method: 'POST',
    body: JSON.stringify({ generator_id, bess_id, load_profile_id, custom_hourly_kw, fuel_price_per_liter, dispatch }),
  });
}

/** Save a comparison session and return { session_uuid, ... } */
async function saveComparison({ generator_ids, load_pct, fuel_price_per_liter }) {
  return _fetch('/comparisons', {
    method: 'POST',
    body: JSON.stringify({ generator_ids, load_pct, fuel_price_per_liter }),
  });
}

/** Load a saved comparison session by UUID */
async function getComparison(uuid) {
  return _fetch(`/comparisons/${uuid}`);
}

/** Get scraper status */
async function getScrapeStatus() {
  return _fetch('/admin/scrape/status');
}
