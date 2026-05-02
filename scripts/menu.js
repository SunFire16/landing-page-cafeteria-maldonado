// Render del bloque "Menú del día" (landing) y para Modo TV.

import { getMenuDelDia } from './api.js?v=20260502-tv-allvar2';
import { CONFIG } from './config.js?v=20260502-tv-allvar2';
import { el, clear, formatPrice, safeImage } from './dom.js?v=20260502-tv-allvar2';
import { getCurrentLocation } from './location.js?v=20260502-tv-allvar2';

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

export async function renderAllMenus(container, { variant = 'landing' } = {}) {
  // Solo mostrar skeleton en la carga inicial (container vacío) para evitar
  // el "parpadeo" en cada refresco automático.
  const isInitial = !container.querySelector('.unified-menu, .location-menu');
  if (isInitial) setAllSkeleton(container, variant);

  const results = await Promise.all(CONFIG.locations.map(async (loc) => {
    try {
      const res = await getMenuDelDia(loc.id);
      return {
        loc,
        meta: res?.meta,
        items: Array.isArray(res?.data) ? res.data : [],
      };
    } catch (error) {
      return { loc, error };
    }
  }));

  container.classList.remove('grid-menu', 'grid-menu--landing', 'grid-menu--tv');
  container.classList.add('unified-menu-wrap', `unified-menu-wrap--${variant}`);

  const products = mergeMenuResults(results);
  const fragment = document.createDocumentFragment();
  if (products.length === 0) {
    fragment.append(renderInlineState('Aún no hay menú publicado.', 'Vuelve en unos minutos.'));
  } else {
    fragment.append(el('div', { class: `unified-menu unified-menu--${variant}` }, products.map((item) => renderCard(item, variant))));
  }
  // Swap atómico: limpiamos justo antes de insertar para evitar el flash.
  clear(container);
  container.append(fragment);

  return results;
}

function mergeMenuResults(results) {
  const byProduct = new Map();

  for (const result of results) {
    if (result.error) continue;
    const location = result.loc;
    for (const item of result.items || []) {
      const key = item.id || item.name;
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          ...item,
          locations: [],
          variants: [],
          _variantMap: new Map(),
        });
      }

      const product = byProduct.get(key);
      const availability = getLocationAvailability(item);
      product.locations.push({
        id: location.id,
        label: location.shortName,
        name: result.meta?.locationName || location.name,
        available: availability.available,
        stock: availability.stock,
      });

      for (const variant of getVariants(item)) {
        const variantKey = variant.id || variant.name;
        if (!product._variantMap.has(variantKey)) {
          product._variantMap.set(variantKey, {
            ...variant,
            locations: [],
          });
        }
        const mergedVariant = product._variantMap.get(variantKey);
        const stock = Number(variant.inventoryLocal);
        mergedVariant.locations.push({
          id: location.id,
          label: location.shortName,
          available: !Number.isFinite(stock) || stock > 0,
          stock: Number.isFinite(stock) ? stock : null,
        });
      }
    }
  }

  return Array.from(byProduct.values()).map((product) => {
    product.locations = completeLocationStatuses(product.locations);
    product.variants = Array.from(product._variantMap.values()).map((variant) => ({
      ...variant,
      locations: completeLocationStatuses(variant.locations),
    }));
    delete product._variantMap;
    return product;
  });
}

function completeLocationStatuses(statuses = []) {
  return CONFIG.locations.map((location) => {
    const found = statuses.find((status) => status.id === location.id);
    return found || {
      id: location.id,
      label: location.shortName,
      name: location.name,
      available: false,
      stock: 0,
    };
  });
}

function getLocationAvailability(item) {
  const variants = getVariants(item);
  if (variants.length) {
    const stocks = variants.map((variant) => Number(variant.inventoryLocal)).filter(Number.isFinite);
    if (!stocks.length) return { available: true, stock: null };
    return { available: stocks.some((stock) => stock > 0), stock: stocks.reduce((sum, stock) => sum + Math.max(stock, 0), 0) };
  }
  const stock = Number(item.inventoryLocal);
  if (!Number.isFinite(stock)) return { available: true, stock: null };
  return { available: stock > 0, stock };
}

function setAllSkeleton(container, variant) {
  clear(container);
  container.classList.remove('grid-menu', 'grid-menu--landing', 'grid-menu--tv');
  container.classList.add('location-menus', `location-menus--${variant}`);
  for (const loc of CONFIG.locations) {
    container.append(el('section', { class: 'location-menu location-menu--loading' }, [
      el('div', { class: 'location-menu__head' }, [
        el('span', { class: 'location-menu__eyebrow' }, loc.id),
        el('h3', { class: 'location-menu__title' }, loc.name),
      ]),
      el('div', { class: `grid-menu grid-menu--${variant}` }, [
        el('div', { class: 'card card--skeleton' }, [
          el('div', { class: 'skeleton skeleton--img' }),
          el('div', { class: 'skeleton skeleton--line' }),
          el('div', { class: 'skeleton skeleton--line short' }),
        ]),
      ]),
    ]));
  }
}

function renderLocationMenu(result, variant) {
  const updatedAt = result.meta?.updatedAt ? new Date(result.meta.updatedAt) : null;
  return el('section', { class: 'location-menu' }, [
    el('div', { class: 'location-menu__head' }, [
      el('span', { class: 'location-menu__eyebrow' }, result.loc.id),
      el('h3', { class: 'location-menu__title' }, result.meta?.locationName || result.loc.name),
      updatedAt ? el('span', { class: 'location-menu__updated' }, `Actualizado ${updatedAt.toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}`) : null,
    ]),
    result.error ? renderInlineState('El menú de esta sucursal se está actualizando.', result.error.message)
      : result.items.length === 0 ? renderInlineState('Aún no hay menú publicado para esta sucursal.', 'Vuelve en unos minutos.')
        : el('div', { class: `grid-menu grid-menu--${variant}` }, result.items.map((item) => renderCard(item, variant))),
  ]);
}

function renderInlineState(title, hint) {
  return el('div', { class: 'state state--inline' }, [
    el('p', { class: 'state__title' }, title),
    hint ? el('p', { class: 'state__hint' }, hint) : null,
  ]);
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
  const variants = getVariants(item);
  const priceLabel = getPriceLabel(item, variants);
  const sizeMod = variants.length >= 7 ? 'card--xl' : variants.length >= 5 ? 'card--lg' : '';
  return el('article', { class: `card card--menu card--${variant} ${sizeMod} ${availability.isOut ? 'card--unavailable' : ''}` }, [
    el('div', { class: 'card__media' }, [
      safeImage(item.imageUrl, item.name),
      el('span', { class: `stock-badge ${availability.isOut ? 'stock-badge--out' : ''}` }, availability.label),
    ]),
    el('div', { class: 'card__body' }, [
      el('h3', { class: 'card__title' }, item.name),
      item.locations?.length ? renderLocationStatuses(item.locations) : null,
      item.description ? el('p', { class: 'card__desc' }, item.description) : null,
      variants.length ? renderVariants(variants) : null,
      el('div', { class: 'card__row' }, [
        el('span', { class: 'card__price' }, priceLabel),
        item.category ? el('span', { class: 'tag' }, item.category) : null,
      ]),
    ]),
  ]);
}

function getVariants(item) {
  const raw = item.variants || item.productVariants || item.options || item.presentations || item.sizes || [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((variant, index) => ({
      id: variant.id || variant.variantId || String(index),
      name: variant.name || variant.label || variant.size || variant.presentation || `Opción ${index + 1}`,
      price: Number(variant.price ?? variant.finalPrice ?? variant.salePrice),
      inventoryLocal: variant.inventoryLocal ?? variant.stock ?? variant.quantity,
      locations: Array.isArray(variant.locations) ? variant.locations : undefined,
    }))
    .filter((variant) => Number.isFinite(variant.price));
}

function getPriceLabel(item, variants) {
  const basePrice = Number(item.price);
  if (Number.isFinite(basePrice) && basePrice > 0) return formatPrice(basePrice);
  const variantPrices = variants.map((variant) => variant.price).filter((price) => Number.isFinite(price) && price > 0);
  if (variantPrices.length) return `Desde ${formatPrice(Math.min(...variantPrices))}`;
  return 'Ver opciones';
}

function renderVariants(variants) {
  return el('div', { class: 'variants' }, variants.map((variant) => {
    const stock = Number(variant.inventoryLocal);
    const anyLocationAvailable = variant.locations?.some((loc) => loc.available);
    const isOut = variant.locations?.length ? !anyLocationAvailable : Number.isFinite(stock) && stock <= 0;
    return el('div', { class: `variant ${isOut ? 'variant--out' : ''}` }, [
      el('span', { class: 'variant__name' }, variant.name),
      el('span', { class: 'variant__meta' }, [
        el('span', { class: 'variant__price' }, formatPrice(variant.price)),
        variant.locations?.length ? renderMiniLocationStatuses(variant.locations) : null,
      ]),
    ]);
  }));
}

function renderLocationStatuses(locations) {
  return el('div', { class: 'location-statuses' }, locations.map((loc) => (
    el('span', { class: `location-status ${loc.available ? 'location-status--yes' : 'location-status--no'}` }, [
      el('span', { class: 'location-status__mark' }, loc.available ? '✓' : '×'),
      el('span', { class: 'location-status__label' }, loc.label),
    ])
  )));
}

function renderMiniLocationStatuses(locations) {
  return el('span', { class: 'variant-locations' }, locations.map((loc) => (
    el('span', { class: `variant-location ${loc.available ? 'variant-location--yes' : 'variant-location--no'}`, title: loc.name }, `${loc.available ? '✓' : '×'} ${loc.label}`)
  )));
}

function getAvailability(item) {
  if (Array.isArray(item.locations) && item.locations.length) {
    const anyAvailable = item.locations.some((loc) => loc.available);
    const allAvailable = item.locations.every((loc) => loc.available);
    if (!anyAvailable) return { label: 'Agotado', isOut: true };
    return { label: allAvailable ? 'Ambos locales' : 'Disponible', isOut: false };
  }
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
