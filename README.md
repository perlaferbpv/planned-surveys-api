# Planned Surveys XML API

Servicio HTTP que reproduce la macro **Convert_and_Generate_XML_UTF8** del archivo Excel *Planned surveys generator* (hoja **Data**, datos desde fila 4).

## Columnas (Excel → JSON)

| Columna | Campo JSON |
|---------|------------|
| B `md` | `md` |
| C `incl` | `incl` |
| D `azi` | `azi` |
| E `tvd` | `tvd` |
| F `mdDelta` | `mdDelta` |
| G `vertSect` | `vertSect` |
| H `dls` | `dls` |
| I `dispNs` | `dispNs` |
| J `dispEw` | `dispEw` |

Valores `N/A`, vacíos o nulos se convierten a `-999.25`, igual que en Excel. Las comas decimales se normalizan a punto.

## Hosting sin Azure (recomendado si no tienes suscripción)

Tu convertidor **no necesita servidor**: es solo texto → XML. La carpeta **`web/`** hace lo mismo que la macro, en el navegador.

| Opción | Costo | URL pública | Notas |
|--------|-------|-------------|--------|
| **GitHub Pages / Cloudflare Pages / Netlify** | Gratis | `https://tu-usuario.github.io/...` | Sube solo la carpeta `web`. **Mejor opción** para compartir con cualquiera. |
| **Render / Fly.io / Railway** | Tier gratis limitado | `https://algo.onrender.com` | Sirve la API FastAPI (`render.yaml` incluido). Útil si otros sistemas llaman `POST` con JSON. |
| **Local + enlace temporal** | Gratis | ngrok / Cloudflare Tunnel | Para pruebas rápidas, no ideal 24/7. |
| **Excel + macro** | — | — | Sigue válido sin publicar nada. |

### Probar la web en tu PC (sin publicar)

```powershell
cd C:\Users\PVargas6\Projects\planned-surveys-api\web
python -m http.server 8080
```

Abre `http://127.0.0.1:8080/` → pega datos del Excel → **Descargar Planned_surveys_.xml**.

### Publicar URL gratis (Netlify Drop — sin cuenta Azure)

1. Entra a [app.netlify.com/drop](https://app.netlify.com/drop).
2. Arrastra la carpeta **`web`** completa.
3. Netlify te da una URL tipo `https://random-name.netlify.app` que puedes compartir.

### Publicar con GitHub Pages

1. Crea un repo en GitHub y sube el contenido de **`web/`** (o todo el proyecto con Pages apuntando a `/web`).
2. **Settings → Pages →** carpeta `main` / raíz del sitio.
3. URL: `https://<usuario>.github.io/<repo>/`.

### API en Render (opcional, cuenta gratis)

1. [render.com](https://render.com) → cuenta gratuita → **New → Blueprint** o Web Service.
2. Conecta el repo; usa el archivo `render.yaml`.
3. URL API: `POST https://<nombre>.onrender.com/api/planned-surveys/xml` (el plan free se “duerme” tras inactividad; la primera petición tarda ~1 min).

---

## API FastAPI en local (opcional)

```powershell
cd C:\Users\PVargas6\Projects\planned-surveys-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**URL:** `http://127.0.0.1:8000/api/planned-surveys/xml` (método **POST**)

Documentación interactiva: `http://127.0.0.1:8000/docs`

## Ejemplo (PowerShell)

```powershell
$body = @{
  meta = @{
    name_well = "Well 1"
    name_wellbore = "Borehole 1"
  }
  stations = @(
    @{ md = 0; incl = 0; azi = 0; tvd = 0; mdDelta = "-999.25"; vertSect = 0; dls = "-999.25"; dispNs = 0; dispEw = 0 }
    @{ md = 10; incl = 0; azi = 87; tvd = 10; mdDelta = 10; vertSect = 0; dls = 0; dispNs = 0; dispEw = 0 }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/planned-surveys/xml" -Method Post -Body $body -ContentType "application/json" -OutFile Planned_surveys_.xml
```

## Desplegar en Azure (nube pública)

Requisitos: [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) y una suscripción Azure (puede ser **gratis** con el plan F1).

1. Elige un nombre **único global** (solo minúsculas y números), por ejemplo `plannedsurveyspvargas6`.

2. En PowerShell:

```powershell
cd C:\Users\PVargas6\Projects\planned-surveys-api
winget install -e --id Microsoft.AzureCLI   # si aún no lo tienes; reinicia la terminal
az login                                     # cuenta Microsoft / suscripción pública
.\scripts\deploy-azure.ps1 -AppName plannedsurveyspvargas6
```

3. URLs resultantes (sustituye el nombre):

| Uso | URL |
|-----|-----|
| Health | `https://plannedsurveyspvargas6.azurewebsites.net/health` |
| Swagger | `https://plannedsurveyspvargas6.azurewebsites.net/docs` |
| Generar XML | `POST https://plannedsurveyspvargas6.azurewebsites.net/api/planned-surveys/xml` |

Plan **F1**: sin costo de compute en tier free (con límites de CPU/memoria). Para producción estable usa `-Sku B1` en el script.

Infraestructura: `infra/main.bicep` (App Service Linux, Python 3.12, HTTPS obligatorio).

### Opción B — Portal Azure (sin CLI en tu PC)

1. Entra a [portal.azure.com](https://portal.azure.com) con una suscripción **pública** (Azure for Students, Pay-as-you-go, etc.).
2. **Deploy a custom template** → sube `infra/portal-deploy.bicep` y define el parámetro `appName` (único, minúsculas).
3. En el Web App creado: **Deployment Center** → ZIP o GitHub → sube el contenido del proyecto (carpetas `app`, `requirements.txt`; **no** subas `.venv`).
4. Comprueba `https://<appName>.azurewebsites.net/health`.

### Opción C — GitHub Actions

1. Sube el repo a GitHub.
2. En el Web App (ya creado con Bicep o Portal): **Download publish profile** → secret `AZURE_WEBAPP_PUBLISH_PROFILE` en el repo.
3. **Actions** → workflow **Deploy to Azure App Service** → Run workflow con tu `app_name`.

---

## Publicar en DDH (`https://ddh.apps.slb.com/`)

DDH usa **Azure App Service** con inicio de sesión **Microsoft Entra ID** (al abrir el sitio redirige a `login.microsoftonline.com` y vuelve por `/.auth/login/aad/callback`).

Esta API encaja como **Web App** nueva o como ruta detrás del mismo front door. Tras el despliegue que gestione tu equipo de DDH/DevOps, la URL objetivo sería algo como:

`POST https://ddh.apps.slb.com/api/planned-surveys/xml`

(o, si la montan bajo subpath, `https://ddh.apps.slb.com/planned-surveys/api/planned-surveys/xml` y variable de entorno `ROOT_PATH=/planned-surveys`).

**Qué necesitas del lado SLB (no se puede hacer desde aquí sin permisos):**

1. Slot o app en el mismo tenant/suscripción que `ddh.apps.slb.com`.
2. Pipeline de despliegue (repo interno, Azure DevOps, etc.).
3. Autenticación: normalmente **Easy Auth** ya exige login; para llamadas desde scripts puede hacer falta un token Bearer o una app registration — lo define el equipo de plataforma.

**Artefactos listos en este repo:**

- `requirements.txt` + `startup.sh` (comando típico en App Service Linux: `bash startup.sh`).
- Variable opcional `ROOT_PATH` si hay reverse proxy con prefijo.

**Health check para el equipo de plataforma:** `GET /health`

Si ya existe en DDH un patrón (monorepo, plantilla Bicep, nombre de resource group), comparte el repo o el contacto del pipeline y adaptamos el despliegue al estándar interno.
