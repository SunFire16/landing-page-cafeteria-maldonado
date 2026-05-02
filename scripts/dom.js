// Utilidades DOM mínimas y seguras (sin innerHTML para datos dinámicos).

import { CONFIG } from './config.js?v=20260502-tv-dense8';

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key in node) {
      try { node[key] = value; } catch { node.setAttribute(key, value); }
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function formatPrice(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('es-HN', {
    style: 'currency',
    currency: 'HNL',
    maximumFractionDigits: 2,
  }).format(num);
}

export function safeImage(url, alt) {
  const img = el('img', {
    src: proxiedImageUrl(url),
    alt: alt || '',
    loading: 'lazy',
    decoding: 'async',
    // crossorigin="anonymous" permite que html2canvas pueda usar la imagen en el
    // canvas sin "taint". Requiere que el bucket de Firebase Storage tenga CORS
    // configurado (ver CORS-SETUP.md).
    crossorigin: 'anonymous',
  });
  img.addEventListener('error', () => {
    img.replaceWith(el('div', { class: 'img-fallback', 'aria-hidden': 'true' }, '☕'));
  });
  return img;
}

function proxiedImageUrl(url) {
  if (!url) return '';
  const proxyPath = CONFIG.api.imageProxyPath?.trim();
  if (!proxyPath) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      const joiner = proxyPath.includes('?') ? '&' : '?';
      return `${proxyPath}${joiner}url=${encodeURIComponent(url)}`;
    }
  } catch {
    return url;
  }
  return url;
}
