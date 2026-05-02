const API_BASE = 'https://us-central1-app-cafeteria-maldonado.cloudfunctions.net';

const ALLOWED_ENDPOINTS = new Set([
  'landingMenuDelDia',
  'landingBestSellers',
  'landingFeedback',
]);

exports.handler = async (event) => {
  const endpoint = resolveEndpoint(event.path);
  const method = event.httpMethod || 'GET';

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders('no-store'),
      body: '',
    };
  }

  if (endpoint === 'image') {
    return proxyImage(event);
  }

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return json(404, {
      success: false,
      count: 0,
      data: null,
      error: 'Endpoint no permitido',
      meta: null,
    });
  }

  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [key, value] of Object.entries(event.queryStringParameters || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }

  try {
    const upstream = await fetch(url, {
      method,
      headers: event.body ? { 'Content-Type': 'application/json' } : undefined,
      body: event.body || undefined,
    });

    const text = await upstream.text();
    const cache = method === 'GET' && endpoint === 'landingBestSellers'
      ? 'public, max-age=30, s-maxage=60'
      : 'no-store';
    const contentType = upstream.headers.get('content-type') || '';

    if (!contentType.includes('application/json')) {
      return json(upstream.status, {
        success: false,
        count: 0,
        data: null,
        error: `El backend no devolvió JSON para ${endpoint}. Verifica que la función esté desplegada en la URL documentada.`,
        meta: {
          endpoint,
          upstreamStatus: upstream.status,
        },
      });
    }

    return {
      statusCode: upstream.status,
      headers: {
        'Content-Type': contentType,
        ...corsHeaders(cache),
      },
      body: text,
    };
  } catch (error) {
    return json(502, {
      success: false,
      count: 0,
      data: null,
      error: error.message || 'No se pudo conectar con la API',
      meta: null,
    });
  }
};

async function proxyImage(event) {
  const rawUrl = event.queryStringParameters?.url || '';
  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    return json(400, {
      success: false,
      count: 0,
      data: null,
      error: 'URL de imagen inválida',
      meta: null,
    });
  }

  const allowedHosts = new Set(['firebasestorage.googleapis.com']);
  if (target.protocol !== 'https:' || !allowedHosts.has(target.hostname)) {
    return json(400, {
      success: false,
      count: 0,
      data: null,
      error: 'Host de imagen no permitido',
      meta: null,
    });
  }

  const upstream = await fetch(target.toString());
  if (!upstream.ok) {
    return json(upstream.status, {
      success: false,
      count: 0,
      data: null,
      error: 'No se pudo cargar la imagen del producto',
      meta: { upstreamStatus: upstream.status },
    });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
      ...corsHeaders('public, max-age=86400, s-maxage=86400'),
    },
    body: buffer.toString('base64'),
  };
}

function resolveEndpoint(path = '') {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders('no-store'),
    },
    body: JSON.stringify(payload),
  };
}

function corsHeaders(cacheControl) {
  return {
    'Cache-Control': cacheControl,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}