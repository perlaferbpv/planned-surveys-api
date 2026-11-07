# Publicar en GitHub (con Cursor + Pages)

Ya tienes GitHub enlazado en Cursor. Sigue estos pasos **una vez**; después cada cambio se actualiza con un push.

## 1. Subir el proyecto a un repo nuevo

En **Cursor**:

1. Abre la carpeta `planned-surveys-api` (si no está abierta).
2. Panel **Source Control** (icono de ramas a la izquierda).
3. Si pide **Initialize Repository** → confirma.
4. Escribe mensaje de commit, por ejemplo: `Convertidor Planned Surveys web + API`.
5. **Commit** (marca todos los archivos excepto `.venv`; el `.gitignore` ya la excluye).
6. **Publish to GitHub** / **Publish Branch** → elige **repositorio privado o público**:
   - **Público** si quieres que cualquiera abra la URL del convertidor sin login.
   - Nombre sugerido: `planned-surveys-api`.

Si no aparece “Publish to GitHub”, instala [Git for Windows](https://git-scm.com/download/win), reinicia Cursor y repite.

## 2. Activar GitHub Pages (obligatorio antes del deploy)

En el navegador: **https://github.com/perlaferbpv/planned-surveys-api/settings/pages**

1. **Build and deployment** → **Source**: elige **GitHub Actions** (no “Deploy from a branch”).
2. Si no ves la opción, guarda la página una vez; GitHub a veces provisiona Pages en la primera visita.

Si el workflow falla con **404** / *Ensure GitHub Pages has been enabled*:

1. Confirma que el repo sea **Public** (Settings → General → Danger zone). En cuenta gratis, Pages en repos privados suele fallar.
2. **Settings → Pages → Source = GitHub Actions** (guarda la página).
3. Haz **push** del último `github-pages.yml` (incluye `configure-pages`) y **Re-run** el workflow.

**Plan B (rama `gh-pages`):**

1. **Actions** → **GitHub Pages (rama gh-pages)** → **Run workflow**.
2. **Settings → Pages → Source: Deploy from a branch** → Branch **`gh-pages`** → **`/(root)`**.
3. URL: `https://perlaferbpv.github.io/planned-surveys-api/`

3. Tras el push a `main`, verifica que el job termine en verde.

## 3. Tu URL pública

Será algo como:

`https://<tu-usuario>.github.io/planned-surveys-api/`

(El nombre del repo es el segundo segmento de la URL.)

Ahí está el convertidor: pegar Excel (B–J) → generar / descargar `Planned_surveys_.xml`.

## 4. Actualizar después

En Cursor: Source Control → commit → **Sync** / **Push**. GitHub Actions vuelve a publicar la carpeta `web/` en unos segundos.

## Solo la web (repo mínimo)

Si prefieres un repo solo con el convertidor, sube únicamente `web/index.html` y `web/witsml.js` a la raíz del repo y cambia en el workflow la ruta `path: web` por `.` — o pídele al agente que lo ajuste.

## Probar sin publicar

```powershell
cd C:\Users\PVargas6\Projects\planned-surveys-api\web
python -m http.server 8080
```

Abre `http://127.0.0.1:8080/`.
