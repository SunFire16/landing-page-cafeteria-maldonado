// Entry point del Modo TV: muestra menú del día por sucursal con auto-refresh y exportables.

import { CONFIG } from './config.js?v=20260502-tv-dense6';
import { readLocationFromUrl } from './location.js?v=20260502-tv-dense6';
import { renderAllMenus } from './menu.js?v=20260502-tv-dense6';
import { exportNodeToImage, exportNodeToPdf } from './export.js?v=20260502-tv-dense6';
import { track } from './analytics.js?v=20260502-tv-dense6';

readLocationFromUrl();

const refs = {
  menu: null,
  time: null,
  shell: null,
};

function tickClock() {
  if (!refs.time) return;
  const now = new Date();
  refs.time.textContent = now.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
}

async function refresh() {
  if (refs.menu) await renderAllMenus(refs.menu, { variant: 'tv' });
}

function bindControls() {
  const dockToggle = document.querySelector('[data-tv-dock-toggle]');
  const dockMenu = document.querySelector('[data-tv-dock-menu]');
  const dock = document.querySelector('[data-tv-dock]');

  function setDockOpen(open) {
    if (!dockMenu || !dockToggle || !dock) return;
    dockMenu.hidden = !open;
    dockToggle.setAttribute('aria-expanded', String(open));
    dock.classList.toggle('tv-dock--open', open);
  }

  dockToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    setDockOpen(dockMenu?.hidden ?? false);
  });

  document.addEventListener('click', (e) => {
    if (dock && !dock.contains(e.target)) setDockOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setDockOpen(false);
  });

  document.querySelector('[data-tv-fullscreen]')?.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* ignore */ }
    setDockOpen(false);
  });

  document.querySelector('[data-tv-export-img]')?.addEventListener('click', async () => {
    try {
      track('tv_export', { format: 'png' });
      await exportNodeToImage(refs.shell, fileNameFor('png'));
    } catch (e) { alert(`No se pudo exportar imagen: ${e.message}`); }
    setDockOpen(false);
  });

  document.querySelector('[data-tv-export-pdf]')?.addEventListener('click', async () => {
    try {
      track('tv_export', { format: 'pdf' });
      await exportNodeToPdf(refs.shell, fileNameFor('pdf'));
    } catch (e) { alert(`No se pudo exportar PDF: ${e.message}`); }
    setDockOpen(false);
  });

}

function fileNameFor(ext) {
  const date = new Date().toISOString().slice(0, 10);
  return `menu-ambos-locales-${date}.${ext}`;
}

function init() {
  refs.menu = document.querySelector('[data-tv-menu]');
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
