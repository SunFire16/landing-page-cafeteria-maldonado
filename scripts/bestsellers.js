// Render de productos más vendidos con scope local o global.

import { getBestSellers } from './api.js';
import { el, clear, formatPrice, safeImage } from './dom.js';
import { getCurrentLocation } from './location.js';

export async function renderBestSellers(container, { scope = 'location', limit = 6 } = {}) {
  const loc = getCurrentLocation();
  setSkeleton(container, limit);

  try {
    const res = await getBestSellers({
      scope,
      locationId: scope === 'location' ? loc.id : undefined,
      limit,
    });
    const items = Array.isArray(res?.data) ? res.data : [];
    if (items.length === 0) {
      renderEmpty(container);
      return { count: 0 };
    }
    renderList(container, items);
    return { count: items.length, meta: res?.meta };
  } catch (err) {
    renderError(container, err.message);
    return { count: 0, error: err };
  }
}

function setSkeleton(container, limit) {
  clear(container);
  container.classList.add('grid-best');
  for (let i = 0; i < limit; i++) {
    container.append(el('div', { class: 'card card--skeleton' }, [
      el('div', { class: 'skeleton skeleton--img' }),
      el('div', { class: 'skeleton skeleton--line' }),
    ]));
  }
}

function renderList(container, items) {
  clear(container);
  items.forEach((item, idx) => container.append(renderCard(item, idx + 1)));
}

function renderCard(item, rank) {
  const price = Number(item.price);
  return el('article', { class: 'card card--best' }, [
    el('div', { class: 'card__media' }, [
      el('span', { class: 'rank-badge', 'aria-label': `Top ${rank}` }, `#${rank}`),
      safeImage(item.imageUrl, item.name),
    ]),
    el('div', { class: 'card__body' }, [
      el('h3', { class: 'card__title' }, item.name),
      el('div', { class: 'card__row' }, [
        el('span', { class: 'card__price' }, Number.isFinite(price) && price > 0 ? formatPrice(price) : 'Ver opciones'),
        item.category ? el('span', { class: 'tag' }, item.category) : null,
      ]),
    ]),
  ]);
}

function renderEmpty(container) {
  clear(container);
  container.append(el('div', { class: 'state state--empty' }, [
    el('p', { class: 'state__title' }, 'Aún no tenemos suficientes ventas registradas.'),
  ]));
}

function renderError(container, message) {
  clear(container);
  container.append(el('div', { class: 'state state--error' }, [
    el('p', { class: 'state__title' }, 'Los más vendidos se están actualizando.'),
    el('p', { class: 'state__hint' }, 'Muy pronto verás aquí los productos favoritos de esta sucursal.'),
    el('p', { class: 'state__tech' }, message),
  ]));
}
