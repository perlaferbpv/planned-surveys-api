# Planned Surveys XML API

HTTP service that replicates the Excel macro **Convert_and_Generate_XML_UTF8** from *Planned surveys generator* (sheet **Data**, rows from row 4).

## Columns (Excel → JSON)

| Column | JSON field |
|--------|------------|
| B `md` | `md` |
| C `incl` | `incl` |
| D `azi` | `azi` |
| E `tvd` | `tvd` |
| F `mdDelta` | `mdDelta` |
| G `vertSect` | `vertSect` |
| H `dls` | `dls` |
| I `dispNs` | `dispNs` |
| J `dispEw` | `dispEw` |

`N/A`, empty, or null values become `-999.25`, same as Excel. Decimal commas normalize to dots.

## Public converter (share this link)

| Where | URL | Login |
|--------|-----|--------|
| **GitHub Pages (this repo)** | [https://worktopublic.github.io/planned-surveys-api/](https://worktopublic.github.io/planned-surveys-api/) | None |
| **FastAPI (local / Azure / DDH)** | `http://localhost:8000/` then **`/app`** | SLB OAuth via **`/login`** |

**Important:** `https://worktopublic.github.io/login` is **not** this project. GitHub Pages serves the static **`web/`** app under **`/<repo>/`**, not at the account root and not at `/login`. The path **`/login`** exists only on the **FastAPI** server (`uvicorn` on port **8000**).

## Hosting without Azure

| Option | Cost | Notes |
|--------|------|--------|
| **Local FastAPI / Render / Azure** | Free–low | SLB login + converter at **`/app`** (port **8000**). See `.env` and route table below. |
| **GitHub Pages / Netlify (`web/` only)** | Free | No SLB login; browser-only JS. Published URL must include the **repository name**. |
| **Excel + macro** | — | No deployment needed. |

### Run converter locally (no SLB — same as Pages)

Use this while you change `web/` before pushing to GitHub:

```powershell
cd C:\Users\PVargas6\Projects\planned-surveys-api\web
python -m http.server 8080
```

Open **`http://127.0.0.1:8080/`** (do not open `index.html` with `file://`; ES modules need HTTP).

### Run locally (with SLB login)

Start the API (UI on the same port **8000**):

```powershell
cd C:\Users\PVargas6\Projects\planned-surveys-api
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open **`http://localhost:8000/`** (same host as `SLB_REDIRECT_URI` in `.env`—use **`localhost`**, not `127.0.0.1`) → **Sign in with SLB** → converter at **`/app`** (not `/login` after you are signed in).

Use **`python -m http.server`** on port **8080** only for the **static** converter without OAuth—not for the secured FastAPI app.

### Free public URL (Netlify Drop)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the full **`web`** folder.
3. Share the generated `https://….netlify.app` URL (static only, no SLB).

### GitHub Pages

1. Push to **`main`**; workflow **GitHub Pages (convertidor web)** publishes the **`web/`** folder (see `.github/workflows/github-pages.yml`).
2. **Settings → Pages** → **Source: GitHub Actions** (save once if the first deploy fails).
3. Live URL for this repo: **`https://worktopublic.github.io/planned-surveys-api/`**
4. General pattern: `https://<user>.github.io/<repo>/` — always include **`<repo>`** (here: `planned-surveys-api`).

If the site looks stale after a push, wait 1–2 minutes and hard-refresh (**Ctrl+F5**). To redeploy manually: **Actions** → re-run the Pages workflow.

### Render (optional)

1. [render.com](https://render.com) → connect the repo; use `render.yaml`.
2. `POST https://<name>.onrender.com/api/planned-surveys/xml` (free tier may sleep).

---

## Local FastAPI

```powershell
cd C:\Users\PVargas6\Projects\planned-surveys-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

For **static `web/` only**, see [Run converter locally (no SLB)](#run-converter-locally-no-slb--same-as-pages) above.

### Main routes

| Route | Purpose |
|-------|---------|
| `/` | Redirect to `/login` or `/app` |
| `/login` | **Sign in with SLB** (APS Digital–style layout) |
| `/app` | WITSML converter (session required) |
| `GET /api/auth/login` | Start OAuth → CSI |
| `GET /api/callback` | SLB-registered redirect URI (port **8000**) |
| `GET /api/auth/me` | Session status |
| `GET /api/auth/logout` | Sign out → `/login` |
| `POST /api/planned-surveys/xml` | JSON → XML file |
| `/docs` | Swagger |

### SLB OAuth

Copy `.env.example` → `.env` with `CLIENT_ID`, `CLIENT_SECRET`, `APP_KEY`.  
`SLB_REDIRECT_URI` must match the SLB portal exactly (e.g. `http://localhost:8000/api/callback`).

- Session cookie: `ps_session_id`; tokens stored server-side (`app/session_store.py`).
- Successful login redirects to **`/app`**.
- Optional: `SLB_AUTH_REQUIRED=true` requires session or `Authorization: Bearer` on POST XML.
- Same pattern as **`aps_digital`** (`app/slb_auth.py`, `web/login.html`, `web/slbLogo.png`).

**Tests (no live CSI calls):**

```powershell
.\.venv\Scripts\python.exe -m pytest tests -v
```

Use the **`.venv`** Python; global `python` may not have `pytest`.

## Example (PowerShell)

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

Invoke-RestMethod -Uri "http://localhost:8000/api/planned-surveys/xml" -Method Post -Body $body -ContentType "application/json" -OutFile Planned_surveys_.xml
```

## Deploy to Azure (public cloud)

Requirements: [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) and an Azure subscription (F1 free tier available).

1. Choose a globally unique app name (lowercase, alphanumeric), e.g. `plannedsurveysyourname`.

2. PowerShell:

```powershell
cd C:\Users\PVargas6\Projects\planned-surveys-api
winget install -e --id Microsoft.AzureCLI
az login
.\scripts\deploy-azure.ps1 -AppName plannedsurveysyourname
```

3. Resulting URLs:

| Use | URL |
|-----|-----|
| Health | `https://plannedsurveysyourname.azurewebsites.net/health` |
| Swagger | `https://plannedsurveysyourname.azurewebsites.net/docs` |
| Generate XML | `POST https://plannedsurveysyourname.azurewebsites.net/api/planned-surveys/xml` |

**F1** is free compute with limits; use `-Sku B1` in the script for steadier production.

Infrastructure: `infra/main.bicep` (Linux App Service, Python 3.12, HTTPS).

### Option B — Azure Portal

1. [portal.azure.com](https://portal.azure.com).
2. Deploy custom template → `infra/portal-deploy.bicep`, parameter `appName`.
3. Deployment Center → deploy `app`, `requirements.txt` (not `.venv`).
4. Verify `https://<appName>.azurewebsites.net/health`.

### Option C — GitHub Actions

1. Push to GitHub.
2. Publish profile → secret `AZURE_WEBAPP_PUBLISH_PROFILE`.
3. Run workflow **Deploy to Azure App Service**.

---

## Publishing on DDH (`https://ddh.apps.slb.com/`)

DDH uses **Azure App Service** with **Microsoft Entra ID** (Easy Auth).

Target endpoint after platform deployment, for example:

`POST https://ddh.apps.slb.com/api/planned-surveys/xml`

Or with a subpath: `ROOT_PATH=/planned-surveys` and  
`POST https://ddh.apps.slb.com/planned-surveys/api/planned-surveys/xml`.

**Platform team responsibilities:**

1. App slot in the same tenant/subscription as `ddh.apps.slb.com`.
2. Internal deployment pipeline.
3. Auth for scripts (Bearer token / app registration) per platform standards.

**Repo artifacts:** `requirements.txt`, `startup.sh`, optional `ROOT_PATH`.  
**Health check:** `GET /health`
