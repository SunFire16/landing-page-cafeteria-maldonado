// Manejo de la sucursal activa: persistencia, eventos y validación.

import { CONFIG, getLocationById } from './config.js?v=20260502-tv-dense2';

const STORAGE_KEY = CONFIG.ui.locationStorageKey;

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return getLocationById(raw);
  } catch {
    return null;
  }
}

function getDefault() {
  return CONFIG.locations.find((l) => l.isDefault) ?? CONFIG.locations[0];
}

let current = readStored() ?? getDefault();
const listeners = new Set();

export function getCurrentLocation() {
  return current;
}

export function setCurrentLocation(id) {
  const next = getLocationById(id);
  if (!next || next.id === current.id) return current;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next.id);
  } catch {
    /* storage opcional */
  }
  for (const fn of listeners) fn(current);
  return current;
}

export function onLocationChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function readLocationFromUrl() {
  const params = new URLSearchParams(location.search);
  const id = params.get('local') || params.get('locationId');
  if (id && getLocationById(id)) {
    setCurrentLocation(id);
  }
}
