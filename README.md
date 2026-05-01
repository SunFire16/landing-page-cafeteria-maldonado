# Landing Page · Cafetería Maldonado

Landing estática orientada a conversión hacia la app (Web/iPhone, Android) y al grupo de WhatsApp, con datos en vivo desde la API pública del backend (menú del día, más vendidos) y módulo de feedback privado por sucursal. Incluye **modo TV** dedicado para mostrar el menú del día en pantalla del local, con exportación a **PDF** e **imagen**.

## Stack

- HTML + CSS + JavaScript modular (ES Modules), sin build step.
- Despliegue gratuito en **Netlify** (`netlify.toml` incluido).
- Tipografías: Inter + Playfair Display (Google Fonts).
- Exportación TV: `html2canvas` y `jsPDF` cargados perezosamente desde CDN.

## Estructura

```
.
├── index.html              # Landing principal
├── tv.html                 # Modo TV (menú del día por sucursal)
├── 404.html
├── netlify.toml            # Headers, cache y redirects
├── robots.txt
├── assets/                 # Logo, favicon
├── styles/
│   ├── base.css            # Tokens + utilidades + componentes
│   ├── landing.css
│   └── tv.css
└── scripts/
    ├── config.js           # Endpoints, links, sucursales
    ├── api.js              # Cliente fetch con timeout y caché
    ├── location.js         # Sucursal activa + persistencia
    ├── analytics.js        # Eventos + UTMs
    ├── dom.js              # Helpers de render seguro
    ├── menu.js             # Render menú del día
    ├── bestsellers.js      # Render más vendidos
    ├── feedback.js         # Encuesta privada
    ├── export.js           # PDF / PNG
    ├── landing.js          # Entry: index.html
    └── tv.js               # Entry: tv.html
```

## Endpoints consumidos (backend externo)

Base: `https://us-central1-app-cafeteria-maldonado.cloudfunctions.net`

- `GET /landingMenuDelDia?locationId=LOCAL-01`
- `GET /landingBestSellers?scope=location&locationId=LOCAL-01&limit=6`
- `POST /landingFeedback`

Sucursales soportadas: `LOCAL-01` (Afuera) y `LOCAL-02` (Adentro).

## Desarrollo local

Cualquier servidor estático funciona. Recomendado:

```powershell
npx serve .
# o
python -m http.server 5173
```

Abrir `http://localhost:5173`.

> Si la API está restringida por CORS al dominio Netlify, pide al backend habilitar también `http://localhost:5173` (o el puerto que uses) durante desarrollo.

## Despliegue en Netlify

1. Subir el repo a GitHub.
2. En Netlify: *Add new site → Import from Git*.
3. Configuración:
   - Build command: *(vacío)*
   - Publish directory: `.`
4. Netlify aplicará automáticamente lo definido en [netlify.toml](netlify.toml).

### Redirects útiles

- `/app` → app web
- `/android` → Play Store
- `/whatsapp` → grupo de WhatsApp

Útiles para imprimir QRs cortos hacia la URL canónica.

## QR y campañas

Recomendado generar QRs apuntando con UTM, por ejemplo:

```
https://<tu-dominio>/?utm_source=qr&utm_medium=mesa&utm_campaign=almuerzo&local=LOCAL-01
```

El parámetro `local=LOCAL-01` o `local=LOCAL-02` autoselecciona la sucursal al abrir la landing.

## Modo TV

Ruta: `tv.html?local=LOCAL-01`

- Auto-refresh del menú cada 60 s.
- Reloj integrado.
- Exportación a PNG y PDF desde los controles inferiores.
- Pensado para Full HD; soporta pantalla completa con un clic.

## Analítica

Por defecto se envían eventos a `window.dataLayer` (compatible con GTM/GA4):

- `landing_view`, `tv_view`
- `cta_click` (con `cta` específico)
- `location_change`
- `feedback_submit`
- `tv_export` (`png` / `pdf`)

Cualquier UTM presente en la URL se incluye automáticamente en cada evento.

## Pendientes recomendados al backend

Confirmados como mejoras antes de masificar el QR:

1. Restringir CORS a tus dominios reales (producción y previews concretos).
2. Validar rangos 1–5 en ratings y máximo 500 caracteres en `comment`.
3. Reemplazar `inventoryLocal` por `isAvailable` o `stockStatus` para no exponer inventario exacto.
4. Confirmar `meta.timezone` correcto del negocio.
5. Asegurar que `imageUrl` se sirve con CORS válido para exportación a imagen/PDF.
