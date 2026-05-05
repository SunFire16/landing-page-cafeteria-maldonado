// Render del bloque "Menú del día" (landing) y para Modo TV.

import { getMenuDelDia } from './api.js?v=20260502-tv-dense13';
import { CONFIG } from './config.js?v=20260502-tv-dense13';
import { el, clear, formatPrice, safeImage } from './dom.js?v=20260502-tv-dense13';
import { getCurrentLocation } from './location.js?v=20260502-tv-dense13';

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
    const compactCount = products.filter((p) => (p.variants?.length || 0) < 7).length;
    const xlCount = products.length - compactCount;
    const totalVariants = products.reduce((sum, p) => sum + Math.max(p.variants?.length || 1, 1), 0);
    // Niveles de densidad para TV:
    //  - 'normal': pocos productos, layout grande con imágenes
    //  - 'dense-image': moderado → mantener imágenes pequeñas
    //  - 'dense': mucho contenido → imágenes mini (siguen presentes para no verse muerto)
    let density = 'normal';
    if (variant === 'tv') {
      const heavy = products.length >= 7 || totalVariants >= 22;
      const moderate = products.length >= 4 || totalVariants >= 14 || xlCount >= 1;
      if (heavy) density = 'dense';
      else if (moderate) density = 'dense-image';
    }
    const dense = density === 'dense' || density === 'dense-image';
    container.dataset.compactCount = String(compactCount);
    container.dataset.xlCount = String(xlCount);
    container.dataset.density = density;
    container.dataset.products = String(products.length);

    // Distribución dinámica: cada card recibe un "peso" según cuántas variantes tiene.
    // Las cards con poco contenido se hacen más delgadas para dejar espacio a las grandes.
    const weightOf = (p) => {
      const v = p.variants?.length || 0;
      if (v >= 7) return 12;       // XL: fila completa
      if (v >= 5) return 8;        // grande
      if (v >= 3) return 6;        // media
      if (v >= 1) return 4;        // pequeña con variantes
      return 3;                    // sin variantes: lo más delgado
    };
    const weights = products.map(weightOf);
    // Empacado simple en filas de ancho 12: ajusta el último de cada fila para llenar.
    const rows = [];
    let row = [];
    let rowSum = 0;
    weights.forEach((w, idx) => {
      if (w >= 12) { if (row.length) rows.push(row); rows.push([{ idx, w: 12 }]); row = []; rowSum = 0; return; }
      if (rowSum + w > 12) { rows.push(row); row = []; rowSum = 0; }
      row.push({ idx, w });
      rowSum += w;
    });
    if (row.length) rows.push(row);
    // Reparte el sobrante de cada fila proporcionalmente para llenar 12.
    const finalSpans = new Array(products.length);
    rows.forEach((r) => {
      const sum = r.reduce((s, c) => s + c.w, 0);
      if (sum === 12) { r.forEach(c => { finalSpans[c.idx] = c.w; }); return; }
      const factor = 12 / sum;
      let assigned = 0;
      r.forEach((c, i) => {
        const isLast = i === r.length - 1;
        const span = isLast ? (12 - assigned) : Math.max(2, Math.round(c.w * factor));
        finalSpans[c.idx] = span;
        assigned += span;
      });
    });
    container.dataset.totalRows = String(rows.length);
    container.style.setProperty('--tv-rows', String(rows.length || 1));

    fragment.append(el('div', { class: `unified-menu unified-menu--${variant}` }, products.map((item, idx) => {
      const card = renderCard(item, variant);
      if (variant === 'tv') {
        const span = finalSpans[idx] || 6;
        card.style.setProperty('--card-span', String(span));
        card.dataset.variantCount = String(item.variants?.length || 0);
        card.dataset.weight = String(weights[idx]);
      }
      return card;
    })));
  }
  // Swap atómico: limpiamos justo antes de insertar para evitar el flash.
  clear(container);
  container.append(fragment);

  // Seguro infalible: achicamos tipografía de variantes hasta que quepan.
  // Forzamos layout ANTES del primer paint (void offsetHeight) para que el
  // navegador nunca pinte el estado sin ajustar (sin flash).
  if (variant === 'tv') {
    void container.offsetHeight; // flush layout sincrónico
    fitVariantsToCards(container);
  }

  return results;
}

export function fitVariantsToCards(container) {
  const cards = container.querySelectorAll('.card--menu');
  cards.forEach((card) => {
    const variantsBox = card.querySelector('.variants');
    // Reset previo
    card.style.removeProperty('--variant-fs');
    card.style.removeProperty('--variant-pad');
    card.style.removeProperty('--variant-gap');
    card.style.removeProperty('--card-scale');

    if (!variantsBox) {
      fitCardTypography(card);
      return;
    }

    variantsBox.classList.remove('variants--ultra');

    // Escalas en ambos sentidos: crecer cuando sobra espacio, o achicar si no cabe.
    // Tomamos la más grande que aún quepa.
    const scales = [
      { fs: 1.52, pad: '10px 14px', gap: '5px 10px' },
      { fs: 1.42, pad: '9px 13px',  gap: '5px 9px' },
      { fs: 1.32, pad: '8px 12px',  gap: '4px 9px' },
      { fs: 1.22, pad: '7px 11px',  gap: '4px 8px' },
      { fs: 1.12, pad: '7px 10px',  gap: '4px 8px' },
      { fs: 1.00, pad: null,        gap: null },
      { fs: 0.92, pad: '5px 9px',   gap: '3px 8px' },
      { fs: 0.82, pad: '4px 8px',   gap: '3px 6px' },
      { fs: 0.72, pad: '3px 7px',   gap: '2px 6px' },
      { fs: 0.64, pad: '3px 6px',   gap: '2px 5px' },
      { fs: 0.56, pad: '2px 5px',   gap: '2px 4px' },
      { fs: 0.50, pad: '2px 4px',   gap: '1px 4px' },
    ];

    const fits = () => variantsBox.scrollHeight - variantsBox.clientHeight <= 2;
    let chosen = scales[scales.length - 1];

    for (const scale of scales) {
      chosen = scale;
      card.style.setProperty('--variant-fs', String(scale.fs));
      if (scale.pad) card.style.setProperty('--variant-pad', scale.pad);
      else card.style.removeProperty('--variant-pad');
      if (scale.gap) card.style.setProperty('--variant-gap', scale.gap);
      else card.style.removeProperty('--variant-gap');
      if (fits()) break;
    }

    // Último recurso: si aún no caben, comprimir a "ultra" (chips inline 1-línea)
    if (!fits()) {
      variantsBox.classList.add('variants--ultra');
      card.style.setProperty('--variant-fs', '0.66');
      card.style.setProperty('--variant-pad', '2px 5px');
      card.style.setProperty('--variant-gap', '2px 4px');
    }

    fitCardTypography(card, Math.max(0, chosen.fs - 1));
  });
}

function fitCardTypography(card, variantGrowthBias = 0) {
  const body = card.querySelector('.card__body');
  if (!body) return;

  const sparePx = body.clientHeight - body.scrollHeight;
  if (sparePx <= 6 && variantGrowthBias <= 0.02) {
    card.style.setProperty('--card-scale', '1');
    return;
  }

  const spareRatio = Math.max(0, sparePx) / Math.max(body.clientHeight, 1);
  const scale = 1 + Math.min(0.34, spareRatio * 0.78 + variantGrowthBias * 0.2);
  card.style.setProperty('--card-scale', scale.toFixed(2));
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
  const hasVariants = variants.length ? 'card--has-variants' : '';
  const hasLocations = Array.isArray(item.locations) && item.locations.length > 0;
  const showInlineDescription = variant === 'tv' && hasLocations && Boolean(item.description);
  // Mostrar indicadores de local por variante SOLO si el producto está en ambos locales.
  // Si solo está en uno, todas las variantes comparten esa restricción → es redundante.
  const activeLocs = item.locations?.filter((l) => l.available).length ?? 0;
  const showVariantLocations = activeLocs >= 2;
  return el('article', { class: `card card--menu card--${variant} ${sizeMod} ${hasVariants} ${variants.length && !showVariantLocations ? 'card--single-loc' : ''} ${availability.isOut ? 'card--unavailable' : ''}` }, [
    el('div', { class: 'card__media' }, [
      safeImage(item.imageUrl, item.name),
      el('span', { class: `stock-badge ${availability.isOut ? 'stock-badge--out' : ''}` }, availability.label),
    ]),
    el('div', { class: 'card__body' }, [
      el('h3', { class: 'card__title' }, item.name),
      hasLocations ? renderLocationStatuses(item.locations, showInlineDescription ? item.description : null) : null,
      item.description && !showInlineDescription ? el('p', { class: 'card__desc' }, item.description) : null,
      variants.length ? renderVariants(variants, showVariantLocations) : null,
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

function renderVariants(variants, showVariantLocations = true) {
  return el('div', { class: 'variants' }, variants.map((variant) => {
    const stock = Number(variant.inventoryLocal);
    const anyLocationAvailable = variant.locations?.some((loc) => loc.available);
    const isOut = variant.locations?.length ? !anyLocationAvailable : Number.isFinite(stock) && stock <= 0;
    return el('div', { class: `variant ${isOut ? 'variant--out' : ''}` }, [
      el('span', { class: 'variant__name' }, variant.name),
      el('span', { class: 'variant__meta' }, [
        el('span', { class: 'variant__price' }, formatPrice(variant.price)),
        showVariantLocations && variant.locations?.length ? renderMiniLocationStatuses(variant.locations) : null,
      ]),
    ]);
  }));
}

function renderLocationStatuses(locations, description) {
  const children = locations.map((loc) => (
    el('span', { class: `location-status ${loc.available ? 'location-status--yes' : 'location-status--no'}` }, [
      el('span', { class: 'location-status__mark' }, loc.available ? '✓' : '×'),
      el('span', { class: 'location-status__label' }, loc.label),
    ])
  ));
  if (description) children.push(el('span', { class: 'card__desc-inline' }, description));
  return el('div', { class: 'location-statuses' }, children);
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
