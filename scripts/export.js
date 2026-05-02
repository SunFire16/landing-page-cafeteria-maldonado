// Exportación a PNG y PDF de un nodo del DOM (vista de menú TV).
// Renderiza siempre a tamaño TV fijo (1920x1080) para que la salida
// se vea limpia, sin recortes ni layout responsivo del viewport actual.

import { fitVariantsToCards } from './menu.js?v=20260502-tv-dense6';

const CDN = {
  html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
};

const TARGET_W = 1920;
const TARGET_H = 1080;

let loaded = { html2canvas: false, jspdf: false };

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.append(s);
  });
}

async function ensureHtml2Canvas() {
  if (loaded.html2canvas) return;
  await loadScript(CDN.html2canvas);
  loaded.html2canvas = true;
}

async function ensureJsPdf() {
  if (loaded.jspdf) return;
  await loadScript(CDN.jspdf);
  loaded.jspdf = true;
}

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// Aplica un "tamaño TV" temporal al nodo y dispara el re-fit antes de capturar.
async function withTvDimensions(node, fn) {
  document.body.classList.add('exporting');
  const prev = {
    nodeStyle: node.getAttribute('style') || '',
    bodyOverflow: document.body.style.overflow,
  };
  node.style.width = TARGET_W + 'px';
  node.style.height = TARGET_H + 'px';
  node.style.maxWidth = TARGET_W + 'px';
  node.style.maxHeight = TARGET_H + 'px';
  node.style.minWidth = TARGET_W + 'px';
  node.style.minHeight = TARGET_H + 'px';
  node.style.position = 'relative';
  document.body.style.overflow = 'hidden';

  const wrap = node.querySelector('.unified-menu-wrap');
  if (wrap) {
    wrap.querySelectorAll('.variants.variants--ultra').forEach((v) => v.classList.remove('variants--ultra'));
    wrap.querySelectorAll('.card--menu').forEach((c) => {
      c.style.removeProperty('--variant-fs');
      c.style.removeProperty('--variant-pad');
      c.style.removeProperty('--variant-gap');
    });
    await nextFrame();
    fitVariantsToCards(wrap);
  }
  await Promise.all(
    Array.from(node.querySelectorAll('img')).map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise((res) => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      });
    })
  );
  await nextFrame();

  try {
    return await fn();
  } finally {
    node.setAttribute('style', prev.nodeStyle);
    document.body.style.overflow = prev.bodyOverflow;
    document.body.classList.remove('exporting');
    const wrapBack = node.querySelector('.unified-menu-wrap');
    if (wrapBack) {
      await nextFrame();
      fitVariantsToCards(wrapBack);
    }
  }
}

async function snapshot(node) {
  await ensureHtml2Canvas();
  return withTvDimensions(node, () =>
    window.html2canvas(node, {
      backgroundColor: '#1c100a',
      useCORS: true,
      allowTaint: true,
      scale: 2,
      logging: false,
      width: TARGET_W,
      height: TARGET_H,
      windowWidth: TARGET_W,
      windowHeight: TARGET_H,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
    })
  );
}

export async function exportNodeToImage(node, filename = 'menu.png') {
  const canvas = await snapshot(node);
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function exportNodeToPdf(node, filename = 'menu.pdf') {
  const canvas = await snapshot(node);
  await ensureJsPdf();
  const { jsPDF } = window.jspdf;
  // Canvas siempre 1920x1080 (16:9). A4 horizontal con márgenes.
  const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  const margin = 24;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;
  let drawW = availW;
  let drawH = availW / ratio;
  if (drawH > availH) {
    drawH = availH;
    drawW = availH * ratio;
  }
  const x = (pageW - drawW) / 2;
  const y = (pageH - drawH) / 2;
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', x, y, drawW, drawH);
  pdf.save(filename);
}
