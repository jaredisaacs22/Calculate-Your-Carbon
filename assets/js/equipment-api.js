/**
 * equipment-api.js — Shared API client for all equipment pages.
 * Talks to FastAPI backend at /api/*
 */

const API_BASE = '/api';

async function _fetch(path, options = {}) {
  const resp = await fetch(API_BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }
  return resp.json();
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
