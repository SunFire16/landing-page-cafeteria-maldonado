// Entry point de la landing principal.

import { CONFIG } from './config.js';
import { getCurrentLocation, setCurrentLocation, onLocationChange, readLocationFromUrl } from './location.js';
import { renderMenu } from './menu.js';
import { renderBestSellers } from './bestsellers.js';
import { bindFeedbackForm } from './feedback.js';
import { track } from './analytics.js';

readLocationFromUrl();

function bindLocationSelector() {
  const select = document.querySelector('[data-location-select]');
  if (!select) return;
  // Poblamos opciones desde CONFIG para una sola fuente de verdad.
  for (const loc of CONFIG.locations) {
    const opt = document.createElement('option');
    opt.value = loc.id;
    opt.textContent = loc.name;
    select.append(opt);
  }
  select.value = getCurrentLocation().id;
  select.addEventListener('change', (e) => {
    setCurrentLocation(e.target.value);
    track('location_change', { newLocation: e.target.value });
  });
}

function bindCtas() {
  document.querySelectorAll('[data-cta]').forEach((btn) => {
    btn.addEventListener('click', () => {
      track('cta_click', { cta: btn.dataset.cta });
    });
  });
}

function bindTvLink() {
  const link = document.querySelector('[data-tv-link]');
  if (!link) return;
  const sync = () => {
    const params = new URLSearchParams({ local: getCurrentLocation().id });
    link.href = `tv.html?${params.toString()}`;
  };
  sync();
  onLocationChange(sync);
}

async function loadDynamic() {
  const menuRoot = document.querySelector('[data-menu]');
  const bestRoot = document.querySelector('[data-bestsellers]');
  await Promise.all([
    menuRoot ? renderMenu(menuRoot, { variant: 'landing' }) : null,
    bestRoot ? renderBestSellers(bestRoot, { scope: 'location', limit: 6 }) : null,
  ]);
}

function setupYear() {
  const y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
}

function init() {
  bindLocationSelector();
  bindCtas();
  bindTvLink();
  bindFeedbackForm(document.querySelector('[data-feedback-form]'));
  setupYear();
  loadDynamic();

  onLocationChange((loc) => {
    loadDynamic();
    document.querySelectorAll('[data-location-name]').forEach((n) => {
      n.textContent = loc.shortName;
    });
  });

  // Inicial sincronización del nombre visible
  document.querySelectorAll('[data-location-name]').forEach((n) => {
    n.textContent = getCurrentLocation().shortName;
  });

  track('landing_view');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
