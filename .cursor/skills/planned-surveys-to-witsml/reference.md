# WITSML structure and column reference

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
      <tvd uom="m">…</tvd>
      <incl uom="deg">…</incl>
      <azi uom="deg">…</azi>
      <dispNs uom="m">…</dispNs>
      <dispEw uom="m">…</dispEw>
      <vertSect uom="m">…</vertSect>
      <dls uom="deg/30m">…</dls>
      <mdDelta uom="m">…</mdDelta>
    </trajectoryStation>
  <commonData><itemState>plan</itemState></commonData>
  </trajectory>
</trajectorys>
```

## Header aliases (paste)

Direct header names (priority):

| Header | Field |
|--------|-------|
| MD | `md` |
| Incl | `incl` |
| Azim | `azi` |
| TVD | `tvd` |
| DeltaMD | `mdDelta` |
| VSEC | `vertSect` |
| DLS | `dls` |
| NS | `dispNs` |
| EW | `dispEw` |

Other accepted aliases (non-exhaustive; see `web/witsml.js`):

| Field | Examples |
|-------|----------|
| `md` | Measured Depth, DEPTH, Measured Depth (ft) |
| `incl` | Inclination, INC, Hole Inclination |
| `azi` | Azi, Azimuth, Azim Grid, Hole Azimuth |
| `tvd` | True Vertical Depth |
| `mdDelta` | mdDelta, Delta MD |
| `vertSect` | vertSect, Vertical Section |
| `dls` | Dogleg, DLS (°/30m) |
| `dispNs` | dispNs, Northing |
| `dispEw` | dispEw, Easting |

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

With headers, column order may vary; extra columns are ignored.

## API request schema

```json
{
  "meta": {
    "name_well": "Well 1",
    "name_wellbore": "Borehole 1",
    "trajectory_name": "Survey: Plan",
    "trajectory_uid": "Survey_Plan"
  },
  "stations": [
    {
      "md": 0,
      "incl": 0,
      "azi": 0,
      "tvd": 0,
      "mdDelta": "-999.25",
      "vertSect": 0,
      "dls": "-999.25",
      "dispNs": 0,
      "dispEw": 0
    }
  ]
}
```

`meta` is optional; defaults match Excel macro.

## Deployment notes

- `ROOT_PATH` env for reverse-proxy subpaths (e.g. DDH)
- `GET /health` for probes
- Azure/Linux: `startup.sh` runs uvicorn on `PORT`
