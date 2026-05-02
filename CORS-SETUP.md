# Habilitar CORS en Firebase Storage (necesario para exportar PNG/PDF con imágenes)

Firebase Storage no envía cabeceras CORS por defecto, por lo que `html2canvas` no
puede incluir las imágenes de productos en la exportación a PNG/PDF. Ningún proxy
público (weserv, corsproxy.io, codetabs, allorigins) funciona con URLs de
`firebasestorage.googleapis.com`. La solución correcta y permanente es habilitar
CORS en el bucket directamente.

## Pasos (se ejecuta UNA sola vez)

Requiere [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gsutil` /
`gcloud`) y permiso de Owner sobre el proyecto `app-cafeteria-maldonado`.

```powershell
# 1. Iniciar sesión con la cuenta dueña del proyecto Firebase
gcloud auth login

# 2. Aplicar la configuración CORS al bucket
gsutil cors set firebase-storage.cors.json gs://app-cafeteria-maldonado.appspot.com

# 3. (Opcional) Verificar que se aplicó
gsutil cors get gs://app-cafeteria-maldonado.appspot.com
```

Después de aplicar la configuración:

- Los `<img>` con `crossorigin="anonymous"` ya cargarán correctamente desde
  `https://sunfire16.github.io`.
- `html2canvas` podrá pintar las imágenes en el canvas sin marcarlo como
  "tainted" y la exportación a PNG/PDF saldrá completa, con todas las imágenes.

## Notas

- El archivo [`firebase-storage.cors.json`](firebase-storage.cors.json) ya
  incluye `https://sunfire16.github.io` (GitHub Pages) y orígenes locales para
  desarrollo. Agregá más orígenes si fuera necesario y volvé a aplicar el comando.
- Si en algún momento se cambia de bucket, ajustá la URL `gs://...`.
