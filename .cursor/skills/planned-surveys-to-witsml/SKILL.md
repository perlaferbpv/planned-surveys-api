---
name: planned-surveys-to-witsml
description: Converts planned survey station data (Excel macro Convert_and_Generate_XML_UTF8, geodetic reports, or JSON) into WITSML 1.3.1.1 planned trajectory XML (Planned_surveys_.xml). Use when the user mentions planned surveys, WITSML trajectory, Planned_surveys_.xml, paste-from-Excel/Compass/geodetic tables, or columns MD/Incl/Azi/TVD through dispEw.
---

# Planned Surveys → WITSML

Replicate **Convert_and_Generate_XML_UTF8** from the Excel *Planned surveys generator* (sheet **Data**, data from row 4). Output: UTF-8 XML, filename **`Planned_surveys_.xml`**.

## Source of truth in this repo

| Layer | Path | Use |
|-------|------|-----|
| Python (API) | `app/witsml.py` → `build_planned_surveys_xml` | Server-side; must match JS |
| JavaScript (web) | `web/witsml.js` → `buildPlannedSurveysXml`, parsers | Browser paste/CSV; richer column detection |
| HTTP API | `app/main.py` → `POST /api/planned-surveys/xml` | Automation |

When changing XML shape or normalization, update **both** `app/witsml.py` and `web/witsml.js` unless the task is explicitly API-only or web-only.

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

API accepts `snake_case` aliases (`md_delta`, `disp_ns`, …) via Pydantic; XML builders also accept uppercase keys (`MD`, `TVD`, …).

## Normalization rules

Apply to every numeric/text value written into XML:

- `null`, empty string, `N/A` (case-insensitive) → **`-999.25`**
- Decimal commas → **dots**
- Web: numeric values round to **4** decimal places (`formatSurveyDecimal` in `witsml.js`)
- First station: `typeTrajStation` = **`tie in point`**; all others → **`unknown`**
- Each `trajectoryStation@uid` = normalized **MD** of that row
- Trajectory defaults: `nameWell` Well 1, `nameWellbore` Borehole 1, `name` Survey: Plan, `uid` Survey_Plan; `commonData/itemState` = **plan**

**Units:** Macro assumes **meters / degrees** like Excel. Do **not** convert ft→m unless the user asks; pasted numbers are copied as-is.

## How to generate XML

### 1. Web (no server)

```powershell
cd web
python -m http.server 8080
```

Open `http://127.0.0.1:8080/`, paste survey table, download XML.

### 2. Local API

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Docs: `http://127.0.0.1:8000/docs`
- `POST http://127.0.0.1:8000/api/planned-surveys/xml` — JSON body with `stations` and optional `meta`
- Response: `application/xml; charset=utf-8`, attachment `Planned_surveys_.xml`
- At least one station required (400 if empty)

Do **not** run `python -m main.py`; entry point is **`uvicorn app.main:app`**.

### 3. Python in-process

```python
from app.witsml import build_planned_surveys_xml

xml = build_planned_surveys_xml(
    [{"md": 0, "incl": 0, "azi": 0, "tvd": 0, "mdDelta": "-999.25", ...}],
    name_well="Well 1",
    name_wellbore="Borehole 1",
)
```

## Pasted / report data (agent workflow)

1. Identify whether input has **header row** or is fixed-column geodetic layout (often 12 columns).
2. Map columns to the nine station fields using [reference.md](reference.md) and `web/column-aliases.md`.
3. For ambiguous layouts, prefer **`web/witsml.js`** parsers (`HEADER_ALIASES`, geodetic 12-col maps) over hand-mapping.
4. Ignore non-XML columns: TVDSS, DeltaTVD, TVDLL, Closure, lat/long, comments, hole size, MD From/To, etc.
5. Build JSON `stations` + optional `meta`, then call API or `build_planned_surveys_xml`.
6. Validate: UTF-8, root `trajectorys` schema 131, `version="1.3.1.1"`, first station tie-in.

## WITSML envelope (do not invent variants)

- Namespace: `http://www.witsml.org/schemas/131`
- Root: `<trajectorys … version="1.3.1.1">` with single `<trajectory>`
- Planned survey only — not log/trajectory revision workflows unless user requests extension

## Examples

See [examples.md](examples.md) for API JSON and PowerShell samples.

## Extending column detection

New header aliases → extend `HEADER_ALIASES` in `web/witsml.js` and document in `web/column-aliases.md`. Keep Python path unchanged unless API receives pre-parsed JSON only.
