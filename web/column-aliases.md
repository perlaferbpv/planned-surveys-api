# Columnas reconocidas al pegar

El convertidor busca **nombres en la fila de cabecera** (no importa el orden ni columnas extra).

## Campos del XML (macro Excel)

Coincidencia directa (prioritaria):

| Cabecera pegada | Campo XML |
|-----------------|-----------|
| MD | `md` |
| Incl | `incl` |
| Azim | `azi` |
| TVD | `tvd` |
| DeltaMD | `mdDelta` |
| VSEC | `vertSect` |
| DLS | `dls` |
| NS | `dispNs` |
| EW | `dispEw` |

Otros alias:

| Campo XML | Alias comunes (ejemplos) |
|-----------|---------------------------|
| `md` | Measured Depth, DEPTH, Measured Depth (ft) |
| `incl` | Inclination, INC, Hole Inclination |
| `azi` | Azi, Azimuth, Azim Grid, Hole Azimuth |
| `tvd` | True Vertical Depth |
| `mdDelta` | mdDelta, Delta MD |
| `vertSect` | vertSect, Vertical Section |
| `dls` | Dogleg, DLS (°/30m) |
| `dispNs` | dispNs, Northing |
| `dispEw` | dispEw, Easting |

## Reportes geodésicos (p. ej. *Geodetic Interpolated Report*)

Suele incluir **12 columnas**. Sin cabeceras, el orden fijo es:

| Col | Campo XML |
|-----|-----------|
| 1–4 | MD, Incl, Azim, TVD |
| 5 | TVDSS (ignorada) |
| 6 | VSEC → vertSect |
| 7 | AHD (ignorada) |
| 8–9 | NS, EW |
| 10 | DeltaMD → mdDelta |
| 11 | DeltaTVD (ignorada) |
| 12 | DLS |

Con **cabeceras por nombre** el orden puede cambiar; columnas extra no cuentan para el XML.

Layouts frecuentes (12 cols, por **nombre** de cabecera):

- **MD, Incl, Azim, TVD, TVDSS, DeltaTVD, DeltaMD, VSEC, Closure, DLS, NS, EW**
- **MD, Incl, Azim Grid, TVD, TVDSS, TVDLL, DeltaMD, VSEC, Closure, DLS, NS, EW**

Se ignoran columnas extra: **TVDSS**, **DeltaTVD**, **TVDLL**, **Closure**, etc. El orden puede cambiar.

Coincidencias: nombres exactos, variantes (`Azim Grid`, `Delta MD`) y similitud leve en la cabecera (typo de una letra).

Se **ignoran** (no van al XML planificado): TVDSS, TVDLL, DeltaTVD, Closure, Latitude, Longitude, comentarios, hole size, MD From/To, etc.

## CSV con otro idioma o nombre

Pega una fila de cabecera al chat o añádela en `HEADER_ALIASES` dentro de `witsml.js`.

## Nota unidades

La macro asume **metros / grados** como el Excel. Si pegas **Measured Depth (ft)** u otras unidades, los **números** se copian tal cual (sin conversión). Convierte en origen si hace falta metros en el XML.
