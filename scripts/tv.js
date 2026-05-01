// Entry point del Modo TV: muestra menú del día por sucursal con auto-refresh y exportables.

import { CONFIG } from './config.js';
import { getCurrentLocation, setCurrentLocation, readLocationFromUrl } from './location.js';
import { renderMenu } from './menu.js';
import { exportNodeToImage, exportNodeToPdf } from './export.js';
import { track } from './analytics.js';

readLocationFromUrl();

const refs = {
  menu: null,
  locName: null,
  time: null,
  shell: null,
};

function tickClock() {
  if (!refs.time) return;
  const now = new Date();
  refs.time.textContent = now.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
}

async function refresh() {
  const loc = getCurrentLocation();
  if (refs.locName) refs.locName.textContent = loc.shortName;
  if (refs.menu) await renderMenu(refs.menu, { variant: 'tv' });
}

function bindControls() {
  document.querySelector('[data-tv-fullscreen]')?.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* ignore */ }
  });

  document.querySelector('[data-tv-export-img]')?.addEventListener('click', async () => {
    try {
      track('tv_export', { format: 'png' });
      await exportNodeToImage(refs.shell, fileNameFor('png'));
    } catch (e) { alert(`No se pudo exportar imagen: ${e.message}`); }
  });

  document.querySelector('[data-tv-export-pdf]')?.addEventListener('click', async () => {
    try {
      track('tv_export', { format: 'pdf' });
      await exportNodeToPdf(refs.shell, fileNameFor('pdf'));
    } catch (e) { alert(`No se pudo exportar PDF: ${e.message}`); }
  });

  const sel = document.querySelector('[data-tv-location]');
  if (sel) {
    for (const loc of CONFIG.locations) {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.textContent = loc.name;
      sel.append(opt);
    }
    sel.value = getCurrentLocation().id;
    sel.addEventListener('change', (e) => {
      setCurrentLocation(e.target.value);
      refresh();
    });
  }
}

function fileNameFor(ext) {
  const loc = getCurrentLocation();
  const date = new Date().toISOString().slice(0, 10);
  return `menu-${loc.id}-${date}.${ext}`;
}

function init() {
  refs.menu = document.querySelector('[data-tv-menu]');
  refs.locName = document.querySelector('[data-tv-location-name]');
  refs.time = document.querySelector('[data-tv-time]');
  refs.shell = document.querySelector('[data-tv-shell]');

  bindControls();
  tickClock();
  setInterval(tickClock, 30_000);

  refresh();
  setInterval(refresh, CONFIG.ui.tvRefreshMs);

  track('tv_view');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
