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
    const cache = method === 'GET' ? 'public, max-age=60, s-maxage=300' : 'no-store';

    return {
      statusCode: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
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