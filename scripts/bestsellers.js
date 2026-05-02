// Render de productos más vendidos con scope local o global.

import { getBestSellers } from './api.js?v=20260502-tv-dense12';
import { el, clear, formatPrice, safeImage } from './dom.js?v=20260502-tv-dense12';
import { getCurrentLocation } from './location.js?v=20260502-tv-dense12';

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
  const variants = getVariants(item);
  const variantPrices = variants.map((variant) => variant.price).filter((value) => Number.isFinite(value) && value > 0);
  const priceLabel = Number.isFinite(price) && price > 0
    ? formatPrice(price)
    : variantPrices.length ? `Desde ${formatPrice(Math.min(...variantPrices))}` : 'Ver opciones';
  return el('article', { class: 'card card--best' }, [
    el('div', { class: 'card__media' }, [
      el('span', { class: 'rank-badge', 'aria-label': `Top ${rank}` }, `#${rank}`),
      safeImage(item.imageUrl, item.name),
    ]),
    el('div', { class: 'card__body' }, [
      el('h3', { class: 'card__title' }, item.name),
      variants.length ? renderVariants(variants) : null,
      el('div', { class: 'card__row' }, [
        el('span', { class: 'card__price' }, priceLabel),
        item.category ? el('span', { class: 'tag' }, item.category) : null,
      ]),
    ]),
  ]);
}

function getVariants(item) {
  const raw = item.variants || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((variant, index) => ({
      id: variant.id || String(index),
      name: variant.name || `Opción ${index + 1}`,
      price: Number(variant.price),
      inventoryLocal: variant.inventoryLocal,
    }))
    .filter((variant) => Number.isFinite(variant.price));
}

function renderVariants(variants) {
  return el('div', { class: 'variants variants--compact' }, variants.slice(0, 4).map((variant) => {
    const stock = Number(variant.inventoryLocal);
    const stockLabel = Number.isFinite(stock) && stock <= 0 ? ' · Agotado' : '';
    return el('div', { class: `variant ${stockLabel ? 'variant--out' : ''}` }, [
      el('span', { class: 'variant__name' }, variant.name),
      el('span', { class: 'variant__meta' }, `${formatPrice(variant.price)}${stockLabel}`),
    ]);
  }));
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
