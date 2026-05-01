// Exportación a PNG y PDF de un nodo del DOM (vista de menú TV).
// Usa html2canvas + jsPDF cargados perezosamente desde CDN.

const CDN = {
  html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
};

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

async function snapshot(node) {
  await ensureHtml2Canvas();
  return window.html2canvas(node, {
    backgroundColor: '#ffffff',
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, 2),
    logging: false,
  });
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
  const ratio = canvas.width / canvas.height;
  const orientation = ratio > 1 ? 'l' : 'p';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const drawW = pageW - 48;
  const drawH = drawW / ratio;
  const finalH = drawH > pageH - 48 ? pageH - 48 : drawH;
  const finalW = finalH * ratio;
  const x = (pageW - finalW) / 2;
  const y = (pageH - finalH) / 2;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, finalW, finalH);
  pdf.save(filename);
}
