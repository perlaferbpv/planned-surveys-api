---
name: planned-surveys-to-witsml
description: Converts planned survey data to WITSML 1.3.1.1 planned trajectory XML and runs the SLB-gated FastAPI app (login, /app converter). Use for Planned_surveys_.xml, Excel macro Convert_and_Generate_XML_UTF8, geodetic paste, SLB OAuth, CSI callback, or MD/Incl/Azi/TVD through dispEw.
---

# Planned Surveys → WITSML

Replicate **Convert_and_Generate_XML_UTF8** from the Excel *Planned surveys generator* (sheet **Data**, data from row 4). Output: UTF-8 XML, filename **`Planned_surveys_.xml`**.

## Source of truth in this repo

| Layer | Path | Use |
|-------|------|-----|
| Python (API) | `app/witsml.py` → `build_planned_surveys_xml` | Server-side; must match JS |
| JavaScript (web) | `web/witsml.js` → `buildPlannedSurveysXml`, parsers | Browser paste/CSV; richer column detection |
| HTTP API | `app/main.py` → `POST /api/planned-surveys/xml` | Automation |
| SLB OAuth | `app/slb_auth.py`, `app/session_store.py`, `app/slb_auth_deps.py` | CSI login; server-side session |
| UI | `web/login.html`, `web/index.html` | Login (APS Digital style) + converter at `/app` |

When changing XML shape or normalization, update **both** `app/witsml.py` and `web/witsml.js` unless the task is explicitly API-only or web-only.

## Local run (recommended)

```powershell
cd C:\Apps\planned-surveys-api
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open **`http://localhost:8000/`** (same host as `SLB_REDIRECT_URI`, usually **`localhost` not `127.0.0.1`**).

| Route | Purpose |
|-------|---------|
| `/` | Redirect → `/login` or `/app` |
| `/login` | SLB sign-in page |
| `/app` | Converter (requires session) |
| `/api/auth/login` | Start OAuth → CSI |
| `/api/callback` | OAuth redirect URI (port **8000**) |
| `/api/auth/me` | Session JSON |
| `/api/auth/logout` | End session → `/login` |
| `/docs` | Swagger |
| `POST /api/planned-surveys/xml` | JSON → XML file |

Do **not** use `python -m http.server 8080` for the gated app (no SLB). Do **not** run `python -m main.py`; use **`uvicorn app.main:app`**.

Copy `.env.example` → `.env` with `CLIENT_ID`, `CLIENT_SECRET`, `APP_KEY`, `SLB_REDIRECT_URI=http://localhost:8000/api/callback`.

### Session model (OAuth troubleshooting)

- Tokens are stored **server-side** in `app/session_store.py` (not full JWT in cookies).
- Browser cookie: `ps_session_id` (`path=/`, httpOnly).
- After OAuth, redirect is **relative** `/app` (avoids localhost vs 127.0.0.1 cookie loss).
- `uvicorn --reload` clears in-memory sessions; user re-logs in after code changes.
- Optional: `SLB_AUTH_REQUIRED=true` forces Bearer/cookie on `POST /api/planned-surveys/xml`.

Pattern mirrors **aps_digital** (`slb_auth.py`, login layout, `slbLogo.png`).

### Tests

```powershell
.\.venv\Scripts\python.exe -m pytest tests -v
```

Use the **venv** Python, not system `python` (pytest not on global install).

## Station fields (Excel cols B–J)

| Col | JSON / object key | WITSML element | uom |
|-----|-------------------|----------------|-----|
| B | `md` | `md` | m |
| C | `incl` | `incl` | deg |
| D | `azi` | `azi` | deg |
| E | `tvd` | `tvd` | m |
| F | `mdDelta` | `mdDelta` | m |
| G | `vertSect` | `vertSect` | m |
| H | `dls` | `dls` | deg/30m |
| I | `dispNs` | `dispNs` | m |
| J | `dispEw` | `dispEw` | m |

## Normalization rules

- `null`, empty, `N/A` → **`-999.25`**; commas → dots
- Web: **4** decimal places (`formatSurveyDecimal`)
- First station: **`tie in point`**; rest **`unknown`**
- Defaults: Well 1 / Borehole 1 / Survey: Plan / `itemState` plan

**Units:** meters/degrees as Excel; no ft→m unless asked.

## Pasted / report data (agent workflow)

1. Header row vs 12-col geodetic layout → [reference.md](reference.md), `web/column-aliases.md`
2. Prefer `web/witsml.js` parsers over hand-mapping
3. Build `stations` JSON → API or `build_planned_surveys_xml`

## Examples

See [examples.md](examples.md).

## Extending column detection

`HEADER_ALIASES` in `web/witsml.js` + `web/column-aliases.md`.
