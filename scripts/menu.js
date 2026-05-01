// Render del bloque "Menú del día" (landing) y para Modo TV.

import { getMenuDelDia } from './api.js';
import { el, clear, formatPrice, safeImage } from './dom.js';
import { getCurrentLocation } from './location.js';

export async function renderMenu(container, { variant = 'landing' } = {}) {
  const loc = getCurrentLocation();
  setSkeleton(container, variant);

  try {
    const res = await getMenuDelDia(loc.id);
    const items = Array.isArray(res?.data) ? res.data : [];
    container.dataset.updatedAt = res?.meta?.updatedAt ?? '';
    if (items.length === 0) {
      renderEmpty(container);
      return { count: 0, meta: res?.meta };
    }
    renderList(container, items, variant);
    return { count: items.length, meta: res?.meta };
  } catch (err) {
    renderError(container, err.message);
    return { count: 0, error: err };
  }
}

function setSkeleton(container, variant) {
  clear(container);
  container.classList.add('grid-menu', `grid-menu--${variant}`);
  for (let i = 0; i < (variant === 'tv' ? 6 : 4); i++) {
    container.append(el('div', { class: 'card card--skeleton' }, [
      el('div', { class: 'skeleton skeleton--img' }),
      el('div', { class: 'skeleton skeleton--line' }),
      el('div', { class: 'skeleton skeleton--line short' }),
    ]));
  }
}

function renderList(container, items, variant) {
  clear(container);
  for (const item of items) {
    container.append(renderCard(item, variant));
  }
}

function renderCard(item, variant) {
  const availability = getAvailability(item);
  return el('article', { class: `card card--menu card--${variant} ${availability.isOut ? 'card--unavailable' : ''}` }, [
    el('div', { class: 'card__media' }, [
      safeImage(item.imageUrl, item.name),
      el('span', { class: `stock-badge ${availability.isOut ? 'stock-badge--out' : ''}` }, availability.label),
    ]),
    el('div', { class: 'card__body' }, [
      el('h3', { class: 'card__title' }, item.name),
      item.description ? el('p', { class: 'card__desc' }, item.description) : null,
      el('div', { class: 'card__row' }, [
        el('span', { class: 'card__price' }, formatPrice(item.price)),
        item.category ? el('span', { class: 'tag' }, item.category) : null,
      ]),
    ]),
  ]);
}

function getAvailability(item) {
  const raw = item.inventoryLocal;
  const stock = Number(raw);
  if (!Number.isFinite(stock)) {
    return { label: 'Disponible', isOut: false };
  }
  if (stock <= 0) {
    return { label: 'Agotado', isOut: true };
  }
  if (stock <= 5) {
    return { label: `Quedan ${stock}`, isOut: false };
  }
  return { label: 'Disponible', isOut: false };
}

function renderEmpty(container) {
  clear(container);
  container.classList.remove('grid-menu');
  container.append(
    el('div', { class: 'state state--empty' }, [
      el('p', { class: 'state__title' }, 'Aún no hay menú publicado para esta sucursal.'),
      el('p', { class: 'state__hint' }, 'Vuelve en unos minutos o cambia de sucursal.'),
    ]),
  );
}

function renderError(container, message) {
  clear(container);
  container.classList.remove('grid-menu');
  container.append(
    el('div', { class: 'state state--error' }, [
      el('p', { class: 'state__title' }, 'El menú se está actualizando.'),
      el('p', { class: 'state__hint' }, 'Mientras tanto, puedes abrir la app o escribir al grupo de WhatsApp para consultar disponibilidad.'),
      el('div', { class: 'state__actions' }, [
        el('a', { class: 'btn btn--primary', href: 'https://app-cafeteria-maldonado.web.app/', target: '_blank', rel: 'noopener' }, 'Pedir en la app'),
        el('a', { class: 'btn btn--whatsapp', href: 'https://chat.whatsapp.com/Kgoj7HA5a8WG12GiYAC8G5', target: '_blank', rel: 'noopener' }, 'Consultar en WhatsApp'),
      ]),
      el('p', { class: 'state__tech' }, message),
    ]),
  );
}
