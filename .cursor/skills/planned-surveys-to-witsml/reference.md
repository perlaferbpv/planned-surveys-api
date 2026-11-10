# WITSML structure, API, and SLB auth

## SLB OAuth (CSI)

| Env var | Typical value |
|---------|----------------|
| `SLB_AUTHORIZATION_URL` | `https://csi.slb.com/v2/auth` |
| `SLB_TOKEN_URL` | `https://csi.slb.com/v2/token` |
| `SLB_REDIRECT_URI` | `http://localhost:8000/api/callback` |
| `SLB_SCOPES` | e.g. `ccm-user-context-cfsservice.slbservice.com` |
| `SLB_TOKEN_CLIENT_AUTH` | `basic` |

Register **`SLB_REDIRECT_URI` exactly** in the SLB portal. Use the **same browser host** for the app (`localhost:8000` if redirect uses `localhost`).

### Flow

1. `GET /api/auth/login` → CSI with `state` (in-memory, 10 min TTL)
2. User signs in → `GET /api/callback?code&state`
3. Exchange code at `SLB_TOKEN_URL` (Basic auth with `CLIENT_ID` / `CLIENT_SECRET`)
4. `create_session(token_data)` → cookie `ps_session_id`
5. Redirect `302` → `/app`
6. `session_is_valid()` reads session store; `/app` serves `web/index.html`

### Files

| File | Role |
|------|------|
| `app/slb_auth.py` | Authorize URL, token exchange, JWT email claims |
| `app/session_store.py` | In-memory sessions keyed by `ps_session_id` |
| `app/slb_auth_deps.py` | `session_is_valid`, `require_slb_user`, Bearer fallback |
| `web/login.html` | Split hero (Unsplash) + SLB logo (`web/slbLogo.png`) |

### Common login-loop causes

- Opening `127.0.0.1` while `SLB_REDIRECT_URI` uses `localhost` (or vice versa)
- Storing huge JWTs in cookies (fixed: server-side session)
- Cookie `path` not `/` (fixed)
- `uvicorn --reload` clearing sessions mid-test

## XML skeleton

```xml
<?xml version="1.0" encoding="UTF-8"?>
<trajectorys xmlns="http://www.witsml.org/schemas/131" … version="1.3.1.1">
  <trajectory uid="Survey_Plan">
    <nameWell>…</nameWell>
    <nameWellbore>…</nameWellbore>
    <name>Survey: Plan</name>
    <trajectoryStation uid="…">
      <typeTrajStation>tie in point|unknown</typeTrajStation>
      <md uom="m">…</md>
      …
    </trajectoryStation>
    <commonData><itemState>plan</itemState></commonData>
  </trajectory>
</trajectorys>
```

## Header aliases (paste)

See `web/column-aliases.md` and `HEADER_ALIASES` in `web/witsml.js`.

## Geodetic 12-column layout (no headers)

| Col | Maps to |
|-----|---------|
| 1–4 | md, incl, azi, tvd |
| 5 | TVDSS (skip) |
| 6 | vertSect |
| 7 | AHD (skip) |
| 8–9 | dispNs, dispEw |
| 10 | mdDelta |
| 11 | DeltaTVD (skip) |
| 12 | dls |

## API request schema

```json
{
  "meta": {
    "name_well": "Well 1",
    "name_wellbore": "Borehole 1",
    "trajectory_name": "Survey: Plan",
    "trajectory_uid": "Survey_Plan"
  },
  "stations": [{ "md": 0, "incl": 0, "azi": 0, "tvd": 0 }]
}
```

## Deployment

- `ROOT_PATH` for reverse-proxy subpaths
- `GET /health` for probes
- Azure: `startup.sh`, `requirements.txt`, app settings mirror `.env`
- Static `web/` also mounted at `/` for assets (`witsml.js`, icons, fonts)

## Test suite

`tests/test_api_endpoints.py` — all HTTP routes including login, callback, `/app` gate.  
`tests/test_slb_auth.py`, `tests/test_witsml.py`.

Run: `.\.venv\Scripts\python.exe -m pytest tests -v`
