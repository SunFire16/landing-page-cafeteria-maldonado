// Cliente HTTP para los endpoints públicos de la landing.
// Implementa: timeout, parsing seguro, normalización de errores y caché en memoria.

import { CONFIG } from './config.js';

const memoryCache = new Map();

function buildUrl(path, params = {}) {
  const url = new URL(path, CONFIG.api.baseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function request(path, { params = {}, method = 'GET', body, cacheKey } = {}) {
  const url = buildUrl(path, params);
  const now = Date.now();

  if (method === 'GET' && cacheKey) {
    const cached = memoryCache.get(cacheKey);
    if (cached && now - cached.at < CONFIG.api.cacheTtlMs) {
      return cached.value;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.api.timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload || payload.success === false) {
      const message = payload?.error || `HTTP ${response.status}`;
      throw new ApiError(message, response.status, payload);
    }

    if (method === 'GET' && cacheKey) {
      memoryCache.set(cacheKey, { at: now, value: payload });
    }

    return payload;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('La conexión tardó demasiado. Intenta nuevamente.', 0, null);
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(err?.message || 'Error de red', 0, null);
  } finally {
    clearTimeout(timeoutId);
  }
}

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function getMenuDelDia(locationId) {
  return request('/landingMenuDelDia', {
    params: { locationId },
    cacheKey: `menu:${locationId}`,
  });
}

export function getBestSellers({ scope = 'global', locationId, limit = 6 } = {}) {
  return request('/landingBestSellers', {
    params: { scope, locationId, limit },
    cacheKey: `best:${scope}:${locationId ?? '-'}:${limit}`,
  });
}

export function sendFeedback(payload) {
  return request('/landingFeedback', { method: 'POST', body: payload });
}
