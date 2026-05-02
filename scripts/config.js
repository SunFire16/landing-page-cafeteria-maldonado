// Configuración central de la landing.
// Cambiar valores aquí impacta a toda la app sin tocar HTML.

export const CONFIG = Object.freeze({
  api: {
    baseUrl: 'https://us-central1-app-cafeteria-maldonado.cloudfunctions.net',
    imageProxyPath: '',
    timeoutMs: 8000,
    cacheTtlMs: 0,
  },
  links: {
    web: 'https://app-cafeteria-maldonado.web.app/',
    android: 'https://play.google.com/store/apps/details?id=com.cafeteriamaldonado.app',
    whatsapp: 'https://chat.whatsapp.com/Kgoj7HA5a8WG12GiYAC8G5',
  },
  locations: [
    {
      id: 'LOCAL-01',
      name: 'Local 1 — Afuera de la universidad',
      shortName: 'Afuera',
      isDefault: true,
    },
    {
      id: 'LOCAL-02',
      name: 'Local 2 — Dentro de la universidad',
      shortName: 'Adentro',
      isDefault: false,
    },
  ],
  feedback: {
    commentMaxLength: 500,
  },
  ui: {
    locationStorageKey: 'cm.location.v1',
    feedbackCooldownMs: 60_000,
    tvRefreshMs: 30_000,
  },
});

export function getLocationById(id) {
  return CONFIG.locations.find((l) => l.id === id) ?? null;
}
