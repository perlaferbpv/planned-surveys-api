# Recognized columns when pasting

The converter matches **header row names** (order and extra columns do not matter).

## XML fields (Excel macro)

Direct match (priority):

| Pasted header | XML field |
|---------------|-----------|
| MD | `md` |
| Incl | `incl` |
| Azim | `azi` |
| TVD | `tvd` |
| DeltaMD | `mdDelta` |
| VSEC | `vertSect` |
| DLS | `dls` |
| NS | `dispNs` |
| EW | `dispEw` |

Other aliases:

| XML field | Common aliases |
|-----------|----------------|
| `md` | Measured Depth, DEPTH, Measured Depth (ft) |
| `incl` | Inclination, INC, Hole Inclination |
| `azi` | Azi, Azimuth, Azim Grid, Hole Azimuth |
| `tvd` | True Vertical Depth |
| `mdDelta` | mdDelta, Delta MD |
| `vertSect` | vertSect, Vertical Section |
| `dls` | Dogleg, DLS (°/30m) |
| `dispNs` | dispNs, Northing |
| `dispEw` | dispEw, Easting |

## Geodetic reports (e.g. *Geodetic Interpolated Report*)

Often **12 columns**. Without headers, fixed order:

| Col | XML field |
|-----|-----------|
| 1–4 | MD, Incl, Azim, TVD |
| 5 | TVDSS (ignored) |
| 6 | VSEC → vertSect |
| 7 | AHD (ignored) |
| 8–9 | NS, EW |
| 10 | DeltaMD → mdDelta |
| 11 | DeltaTVD (ignored) |
| 12 | DLS |

With headers, order may vary; extra columns are ignored.

Common 12-column header layouts include TVDSS, DeltaTVD, TVDLL, Closure, etc.—those are **ignored** for planned XML.

**Not exported:** TVDSS, TVDLL, DeltaTVD, Closure, lat/long, comments, hole size, MD From/To, etc.

## CSV in another language

Share a header row in chat or add aliases in `HEADER_ALIASES` inside `witsml.js`.

## Units note

The macro assumes **meters / degrees** like Excel. Pasted **ft** values are copied as-is (no conversion). Convert at source if you need meters in XML.
