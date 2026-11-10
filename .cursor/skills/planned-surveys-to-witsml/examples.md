# Examples

## PowerShell → local API

```powershell
$body = @{
  meta = @{
    name_well = "Well 1"
    name_wellbore = "Borehole 1"
  }
  stations = @(
    @{
      md = 0; incl = 0; azi = 0; tvd = 0
      mdDelta = "-999.25"; vertSect = 0; dls = "-999.25"; dispNs = 0; dispEw = 0
    },
    @{
      md = 10; incl = 0; azi = 87; tvd = 10
      mdDelta = 10; vertSect = 0; dls = 0; dispNs = 0; dispEw = 0
    }
  )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8000/api/planned-surveys/xml" `
  -Method Post `
  -Body $body `
  -ContentType "application/json" `
  -OutFile Planned_surveys_.xml
```

## curl

```bash
curl -s -X POST http://127.0.0.1:8000/api/planned-surveys/xml \
  -H "Content-Type: application/json" \
  -d '{"stations":[{"md":0,"incl":0,"azi":0,"tvd":0}]}' \
  -o Planned_surveys_.xml
```

## Minimal station row (missing opcionals)

Omitted or null fields become `-999.25` in XML after normalization.

## Paste workflow (agent)

User pastes TSV from Compass / geodetic report:

1. Detect header row vs raw 12-column grid.
2. Produce `stations` array in chat or save as `.json`.
3. Run API or import into `build_planned_surveys_xml` for one-off scripts.

Example derived row after mapping:

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

European decimals in paste (`45,25`) are normalized to dots in output.
