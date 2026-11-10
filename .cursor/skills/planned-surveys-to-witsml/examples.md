# Examples

## Browser (SLB login)

1. `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
2. Open `http://localhost:8000/`
3. **Continue to SLB sign-in** → CSI → return to `/app`
4. Paste survey data → export XML (client-side via `witsml.js`)

## PowerShell → local API (no browser)

```powershell
$body = @{
  meta = @{ name_well = "Well 1"; name_wellbore = "Borehole 1" }
  stations = @(
    @{ md = 0; incl = 0; azi = 0; tvd = 0
       mdDelta = "-999.25"; vertSect = 0; dls = "-999.25"; dispNs = 0; dispEw = 0 }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "http://localhost:8000/api/planned-surveys/xml" `
  -Method Post `
  -Body $body `
  -ContentType "application/json" `
  -OutFile Planned_surveys_.xml
```

With `SLB_AUTH_REQUIRED=true`, add session cookie from browser or:

```powershell
Invoke-RestMethod ... -Headers @{ Authorization = "Bearer <access_token>" }
```

## curl

```bash
curl -s -X POST http://localhost:8000/api/planned-surveys/xml \
  -H "Content-Type: application/json" \
  -d '{"stations":[{"md":0,"incl":0,"azi":0,"tvd":0}]}' \
  -o Planned_surveys_.xml
```

## Check session

```bash
curl -s -b cookies.txt -c cookies.txt http://localhost:8000/api/auth/me
```

## Paste workflow (agent)

Map TSV/geodetic report → `stations` JSON → POST or `build_planned_surveys_xml`.

```json
{
  "md": "1250.5",
  "incl": "45.25",
  "azi": "87.0",
  "tvd": "1100.0",
  "mdDelta": "30",
  "vertSect": "500",
  "dls": "2.5",
  "dispNs": "120",
  "dispEw": "-45"
}
```

European decimals (`45,25`) normalize to dots in XML output.
