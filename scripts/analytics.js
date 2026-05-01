// Registro ligero de eventos. Si en el futuro se conecta GA4/Plausible/etc.,
// solo hay que cambiar la implementación de `track` sin tocar consumidores.

import { getCurrentLocation } from './location.js';

const queue = [];

export function track(event, props = {}) {
  const utm = readUtm();
  const payload = {
    event,
    ts: new Date().toISOString(),
    locationId: getCurrentLocation()?.id ?? null,
    ...utm,
    ...props,
  };
  queue.push(payload);
  if (window.dataLayer) {
    window.dataLayer.push(payload);
  }
  if (window?.console?.debug) {
    console.debug('[analytics]', payload);
  }
}

function readUtm() {
  try {
    const params = new URLSearchParams(location.search);
    const out = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const v = params.get(key);
      if (v) out[key] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function getEvents() {
  return queue.slice();
}
