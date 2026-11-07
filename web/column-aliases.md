# Columnas reconocidas al pegar

El convertidor busca **nombres en la fila de cabecera** (no importa el orden ni columnas extra).

## Campos del XML (macro Excel)

| Campo XML | Alias comunes (ejemplos) |
|-----------|---------------------------|
| `md` | MD, Measured Depth, DEPTH, Measured Depth (ft), DEPTH (m) |
| `incl` | Incl, Inclination, INC, Hole Inclination |
| `azi` | Azi, Azim, Azimuth, Hole Azimuth |
| `tvd` | TVD, True Vertical Depth |
| `mdDelta` | mdDelta, DeltaMD, Delta MD |
| `vertSect` | vertSect, VSEC, Vertical Section |
| `dls` | DLS, Dogleg, DLS (°/30m) |
| `dispNs` | dispNs, NS, Northing |
| `dispEw` | dispEw, EW, Easting |

## Reportes geodésicos (p. ej. *Geodetic Interpolated Report*)

Suele incluir columnas extra. Se usan estas si están presentes:

- **MD**, **Incl**, **Azim**, **TVD**, **DeltaMD**, **VSEC**, **DLS**, **NS**, **EW**

Se **ignoran** (no van al XML planificado): TVDSS, DeltaTVD, Closure, Latitude, Longitude, comentarios, hole size, MD From/To, etc.

## CSV con otro idioma o nombre

Pega una fila de cabecera al chat o añádela en `HEADER_ALIASES` dentro de `witsml.js`.

## Nota unidades

La macro asume **metros / grados** como el Excel. Si pegas **Measured Depth (ft)** u otras unidades, los **números** se copian tal cual (sin conversión). Convierte en origen si hace falta metros en el XML.
