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

## 2. Activar GitHub Pages

En el navegador, en **github.com** → tu repo:

1. **Settings** → **Pages** (menú izquierdo).
2. **Build and deployment** → **Source**: elige **GitHub Actions** (no “Deploy from branch”).
3. Tras el primer push a `main`, entra a la pestaña **Actions** y verifica que el workflow **GitHub Pages (convertidor web)** termine en verde.

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
