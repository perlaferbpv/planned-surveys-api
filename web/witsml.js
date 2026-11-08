/** Valores fijos de la macro Convert_and_Generate_XML_UTF8 */
export const DEFAULT_META = {
  nameWell: "Well 1",
  nameWellbore: "Borehole 1",
  trajectoryName: "Survey: Plan",
  trajectoryUid: "Survey_Plan",
};

export const STATION_FIELDS = [
  "md",
  "incl",
  "azi",
  "tvd",
  "mdDelta",
  "vertSect",
  "dls",
  "dispNs",
  "dispEw",
];

/** Layout típico reporte geodésico (12 columnas). */
const GEODETIC_12_LABELS = {
  md: "MD",
  incl: "Incl",
  azi: "Azim",
  tvd: "TVD",
  mdDelta: "DeltaMD",
  vertSect: "VSEC",
  dls: "DLS",
  dispNs: "NS",
  dispEw: "EW",
};

function geodetic12ColumnMap(offset = 0) {
  return {
    md: offset + 0,
    incl: offset + 1,
    azi: offset + 2,
    tvd: offset + 3,
    vertSect: offset + 5,
    dispNs: offset + 7,
    dispEw: offset + 8,
    mdDelta: offset + 9,
    dls: offset + 11,
  };
}

function maxColumnCount(rows) {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

/**
 * Cabeceras reconocidas (ver también column-aliases.md).
 * Orden importa: el primer alias que coincida gana.
 */
const HEADER_ALIASES = {
  md: [
    "md",
    "mdm",
    "deph",
    "depthmd",
    "measureddepth",
    "measureddepthm",
    "measureddepthft",
    "measureddepthmetres",
    "measureddepthmeters",
    "holedepth",
    "surveydepth",
    "depth",
  ],
  incl: [
    "incl",
    "inc",
    "inclination",
    "incldeg",
    "incdeg",
    "deviation",
    "holeinclination",
    "holeincl",
    "cinc",
    "dev",
  ],
  azi: [
    "azi",
    "az",
    "azim",
    "azimuth",
    "azimuthdeg",
    "aziang",
    "heading",
    "holeazimuth",
    "holeazi",
    "hazi",
    "azimgrid",
  ],
  tvd: ["tvd", "tvdm", "trueverticaldepth", "truevertdepth", "vertdepth"],
  mdDelta: ["mddelta", "deltamd", "mdelta", "dmd", "mddel", "mdchange", "mddiff"],
  vertSect: ["vertsect", "vsec", "verticalsection", "vertsection", "vertsec", "vs"],
  dls: [
    "dls",
    "dl",
    "dogleg",
    "doglegseverity",
    "dls30",
    "dlsdeg30m",
    "dlsdeg30ft",
  ],
  dispNs: [
    "dispns",
    "ns",
    "displacementns",
    "deltans",
    "mdispns",
    "north",
    "northing",
    "northingm",
    "coordns",
    "ycoord",
  ],
  dispEw: [
    "dispew",
    "ew",
    "displacementew",
    "deltaew",
    "mdispew",
    "east",
    "easting",
    "eastingm",
    "coordew",
    "xcoord",
  ],
};

/** Cabeceras que no se mapean a campos de survey (se ignoran al buscar columna). */
const IGNORED_HEADER_TOKENS = new Set([
  "tvdss",
  "tvdl",
  "tvdll",
  "deltatvd",
  "ahd",
  "closure",
  "latitude",
  "longitude",
  "lat",
  "long",
  "lon",
  "comments",
  "comment",
  "description",
  "survey",
  "reportdate",
  "endmd",
  "holesize",
  "casingsize",
  "vendor",
  "part",
  "mdfrom",
  "mdto",
  "eoufreq",
  "expectedmaxinclination",
]);

/** Coincidencia por prefijo cuando el nombre trae sufijos o unidades pegadas. */
const HEADER_PREFIX_TO_FIELD = [
  ["measureddepth", "md"],
  ["deltamd", "mdDelta"],
  ["verticalsection", "vertSect"],
  ["holeinclination", "incl"],
  ["holeincl", "incl"],
  ["holeazimuth", "azi"],
  ["trueverticaldepth", "tvd"],
];

/** Aliases largos primero para que "deltamd" gane sobre "md". */
const SORTED_HEADER_ALIAS_ENTRIES = (() => {
  /** @type {{ field: string, alias: string }[]} */
  const entries = [];
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) entries.push({ field, alias });
  }
  entries.sort((a, b) => b.alias.length - a.alias.length);
  return entries;
})();

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

const UNIT_TOKENS = new Set([
  "m",
  "ft",
  "deg",
  "degs",
  "degree",
  "degrees",
  "deg/30m",
  "deg/100ft",
  "deg/100m",
]);

export function normalizeForXml(value) {
  if (value === null || value === undefined) return "-999.25";
  const s = String(value).trim();
  if (s === "" || s.toUpperCase() === "N/A") return "-999.25";
  return s.replace(",", ".");
}

export function buildPlannedSurveysXml(stations, meta = {}) {
  const {
    nameWell = DEFAULT_META.nameWell,
    nameWellbore = DEFAULT_META.nameWellbore,
    trajectoryName = DEFAULT_META.trajectoryName,
    trajectoryUid = DEFAULT_META.trajectoryUid,
  } = { ...DEFAULT_META, ...meta };

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<trajectorys xmlns="http://www.witsml.org/schemas/131" ',
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ',
    'xsi:schemaLocation="http://www.witsml.org/schemas/131 http://www.witsml.org/schemas/131/obj_trajectory.xsd" ',
    'version="1.3.1.1">',
    `  <trajectory uid="${trajectoryUid}">`,
    `    <nameWell>${nameWell}</nameWell>`,
    `    <nameWellbore>${nameWellbore}</nameWellbore>`,
    `    <name>${trajectoryName}</name>`,
  ];

  stations.forEach((station, index) => {
    const md = station.md;
    const uid = normalizeForXml(md);
    const type = index === 0 ? "tie in point" : "unknown";
    lines.push(`    <trajectoryStation uid="${uid}">`);
    lines.push(`      <typeTrajStation>${type}</typeTrajStation>`);
    lines.push(`      <md uom="m">${normalizeForXml(md)}</md>`);
    lines.push(`      <tvd uom="m">${normalizeForXml(station.tvd)}</tvd>`);
    lines.push(`      <incl uom="deg">${normalizeForXml(station.incl)}</incl>`);
    lines.push(`      <azi uom="deg">${normalizeForXml(station.azi)}</azi>`);
    lines.push(`      <dispNs uom="m">${normalizeForXml(station.dispNs)}</dispNs>`);
    lines.push(`      <dispEw uom="m">${normalizeForXml(station.dispEw)}</dispEw>`);
    lines.push(`      <vertSect uom="m">${normalizeForXml(station.vertSect)}</vertSect>`);
    lines.push(`      <dls uom="deg/30m">${normalizeForXml(station.dls)}</dls>`);
    lines.push(`      <mdDelta uom="m">${normalizeForXml(station.mdDelta)}</mdDelta>`);
    lines.push("    </trajectoryStation>");
  });

  lines.push("    <commonData>");
  lines.push("      <itemState>plan</itemState>");
  lines.push("    </commonData>");
  lines.push("  </trajectory>");
  lines.push("</trajectorys>");

  return lines.join("\n") + "\n";
}

/** UTF-8 sin BOM, como la macro del Excel */
export function encodeUtf8NoBom(text) {
  return new TextEncoder().encode(text);
}

function cleanCell(cell) {
  if (cell == null) return "";
  let s = String(cell).trim();
  s = s.replace(/^["']+|["']+$/g, "");
  s = s.replace(/\r?\n/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

function normalizeHeaderToken(cell) {
  if (!cell) return "";
  let s = cleanCell(cell).toLowerCase();
  s = s.replace(/°/g, "");
  s = s.replace(/\(.*?\)/g, "");
  s = s.replace(/[\s_\-./\\"]+/g, "");
  return s;
}

function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 12);
  const scores = { "\t": 0, ";": 0, ",": 0 };
  for (const line of lines) {
    scores["\t"] += (line.match(/\t/g) ?? []).length;
    scores[";"] += (line.match(/;/g) ?? []).length;
    scores[","] += (line.match(/,/g) ?? []).length;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : "\t";
}

function looksLikeNumericDataLine(line) {
  const tokens = line.trim().split(/\s+/).map(cleanCell);
  if (tokens.length < 9) return false;
  const numeric = tokens.filter((t) => {
    if (!t) return true;
    const s = t.replace(",", ".");
    return /^-?\d/.test(s) || s.toUpperCase() === "N/A";
  });
  return numeric.length >= tokens.length * 0.85;
}

function splitLine(line, delimiter) {
  const parts = line.split(delimiter).map(cleanCell);
  if (parts.length > 1) return parts;
  const spaced = line.trim().split(/\s{2,}/).map(cleanCell);
  if (spaced.length > 1) return spaced;
  if (looksLikeNumericDataLine(line)) {
    return line.trim().split(/\s+/).map(cleanCell);
  }
  return parts;
}

function splitPastedGrid(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const delimiter = detectDelimiter(trimmed);
  return trimmed
    .split(/\r?\n/)
    .map((line) => (line.trim() === "" ? [] : splitLine(line, delimiter)));
}

function isNumericSurveyMd(value) {
  const s = cleanCell(value).replace(",", ".");
  if (!s || s.toUpperCase() === "N/A") return false;
  return /^-?\d/.test(s);
}

function rowLooksLikeLabelRow(cells) {
  let hits = 0;
  for (const cell of cells) {
    const cleaned = cleanCell(cell);
    if (!cleaned) continue;
    const token = normalizeHeaderToken(cleaned);
    if (fieldForHeaderToken(token) || IGNORED_HEADER_TOKENS.has(token)) hits++;
    if (UNIT_TOKENS.has(cleaned.toLowerCase()) || /^\([^)]*\)$/.test(cleaned)) hits++;
  }
  return hits >= 2;
}

function isValidSurveyDataRow(cells, columnMap) {
  const station = stationFromRow(cells, columnMap);
  const md = cleanCell(station.md);
  if (!isNumericSurveyMd(md)) return false;
  if (rowLooksLikeLabelRow(cells)) return false;
  return true;
}

function tryBuildHeaderFromRows(rows, index) {
  const a = rows[index].map(cleanCell);
  let map = buildColumnMap(a);
  if (map.md !== undefined && countMappedFields(map) >= 3) {
    let dataStart = index + 1;
    if (dataStart < rows.length && rowLooksLikeUnits(rows[dataStart].map(cleanCell))) {
      dataStart += 1;
    }
    return { map, headerRowIndex: index, dataStart };
  }

  if (index + 1 >= rows.length) return null;

  const b = rows[index + 1].map(cleanCell);
  if (rowLooksLikeHeader(a) && rowLooksLikeUnits(b)) {
    map = buildColumnMap(a);
    if (map.md !== undefined) {
      return { map, headerRowIndex: index, dataStart: index + 2 };
    }
  }

  const combined = a.map((c, j) => `${c} ${b[j] ?? ""}`.trim());
  map = buildColumnMap(combined);
  if (map.md !== undefined && countMappedFields(map) >= 3) {
    let dataStart = index + 2;
    if (dataStart < rows.length && rowLooksLikeUnits(rows[dataStart].map(cleanCell))) {
      dataStart += 1;
    }
    return { map, headerRowIndex: index, dataStart };
  }

  return null;
}

function fieldForHeaderToken(token) {
  if (!token) return null;
  if (IGNORED_HEADER_TOKENS.has(token)) return null;

  for (const { field, alias } of SORTED_HEADER_ALIAS_ENTRIES) {
    if (token === alias) return field;
  }
  for (const [prefix, field] of HEADER_PREFIX_TO_FIELD) {
    if (token === prefix || token.startsWith(prefix)) return field;
  }

  for (const { field, alias } of SORTED_HEADER_ALIAS_ENTRIES) {
    if (alias.length >= 4 && token.includes(alias)) return field;
    if (token.length >= 4 && alias.includes(token)) return field;
  }

  if (token.length >= 4) {
    let bestField = null;
    let bestDist = 2;
    for (const { field, alias } of SORTED_HEADER_ALIAS_ENTRIES) {
      if (Math.abs(token.length - alias.length) > 2) continue;
      const dist = levenshtein(token, alias);
      if (dist < bestDist) {
        bestDist = dist;
        bestField = field;
      }
    }
    if (bestField) return bestField;
  }

  return null;
}

function buildColumnMap(headerRow) {
  /** @type {Record<string, number>} */
  const map = {};
  headerRow.forEach((cell, index) => {
    const token = normalizeHeaderToken(cell);
    const field = fieldForHeaderToken(token);
    if (field && map[field] === undefined) map[field] = index;
  });
  return map;
}

function countMappedFields(map) {
  return STATION_FIELDS.filter((f) => map[f] !== undefined).length;
}

function rowLooksLikeHeader(cells) {
  const map = buildColumnMap(cells);
  return map.md !== undefined && countMappedFields(map) >= 3;
}

function rowLooksLikeUnits(cells) {
  if (!cells.length) return false;
  const hits = cells.filter((c) => {
    const t = cleanCell(c).toLowerCase();
    return UNIT_TOKENS.has(t) || /^\([^)]*\)$/.test(cleanCell(c));
  });
  return hits.length >= Math.min(3, Math.ceil(cells.length * 0.35));
}

function rowLooksLikeData(cells) {
  const joined = cells.join(" ").toLowerCase();
  if (rowLooksLikeHeader(cells) || rowLooksLikeUnits(cells)) return false;
  const first = cells.find((c) => c !== "");
  if (!first) return false;
  return /^-?\d/.test(first) || first.toUpperCase() === "N/A";
}

function stationFromRow(cells, columnMap) {
  /** @type {Record<string, string>} */
  const station = {};
  for (const field of STATION_FIELDS) {
    const idx = columnMap[field];
    station[field] = idx !== undefined ? cleanCell(cells[idx]) : "";
  }
  return station;
}

function isEmptyStation(station) {
  return STATION_FIELDS.every((f) => station[f] === "");
}

function legacyColumnMap(startIndex, count) {
  const map = {};
  for (let i = 0; i < Math.min(count, STATION_FIELDS.length); i++) {
    map[STATION_FIELDS[i]] = startIndex + i;
  }
  return map;
}

function findLegacyStartIndex(rows) {
  for (const row of rows.slice(0, 8)) {
    const mdIdx = row.findIndex(
      (c) => normalizeHeaderToken(c) === "md" || fieldForHeaderToken(normalizeHeaderToken(c)) === "md"
    );
    if (mdIdx >= 0 && rowLooksLikeHeader(row)) {
      return { map: buildColumnMap(row), headerRow: true, mdIdx };
    }
    if (mdIdx >= 0) {
      return { map: legacyColumnMap(mdIdx, 9), headerRow: false, mdIdx };
    }
  }
  return { map: legacyColumnMap(0, 9), headerRow: false, mdIdx: 0 };
}

function inferFirstNumericColumn(row) {
  return row.findIndex((c) => /^-?\d/.test(String(c).trim()) || String(c).trim().toUpperCase() === "N/A");
}

function excelColumnLetter(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function sourceLabelsForMap(rows, columnMap, headerRowIndex, mode) {
  /** @type {Record<string, string>} */
  const labels = {};
  for (const field of STATION_FIELDS) {
    const idx = columnMap[field];
    if (idx === undefined) {
      labels[field] = "—";
      continue;
    }
    if (mode === "geodetic-12") {
      labels[field] = GEODETIC_12_LABELS[field] ?? `Col ${excelColumnLetter(idx)}`;
      continue;
    }
    if (mode === "header" && headerRowIndex >= 0) {
      const raw = cleanCell(rows[headerRowIndex][idx] ?? "");
      labels[field] = raw !== "" ? raw : `Col ${excelColumnLetter(idx)}`;
    } else {
      labels[field] = `Col ${excelColumnLetter(idx)} (position)`;
    }
  }
  return labels;
}

function headerMapLooksUsable(map) {
  return map.md !== undefined && countMappedFields(map) >= 6;
}

function applyGeodetic12LayoutIfNeeded(rows, columnMap, headerRowIndex, mode) {
  const maxCols = maxColumnCount(rows);

  if (headerRowIndex >= 0) {
    const headerMap = buildColumnMap(rows[headerRowIndex].map(cleanCell));
    if (headerMapLooksUsable(headerMap)) {
      return { columnMap: headerMap, mode: "header", headerRowIndex };
    }
  }

  if (mode === "header" && headerMapLooksUsable(columnMap)) {
    return { columnMap, mode, headerRowIndex };
  }

  if (maxCols < 12) return { columnMap, mode, headerRowIndex };

  const offset = columnMap.md ?? 0;
  const wrongSequentialBToJ =
    columnMap.mdDelta === offset + 4 && columnMap.dls === offset + 6;
  const needsGeodetic12 =
    mode !== "header" &&
    (wrongSequentialBToJ || countMappedFields(columnMap) < 6);

  if (needsGeodetic12) {
    return {
      columnMap: geodetic12ColumnMap(offset),
      mode: "geodetic-12",
      headerRowIndex: -1,
    };
  }

  return { columnMap, mode, headerRowIndex };
}

/**
 * Interpreta pegado desde Excel/CSV: columnas desordenadas y columnas extra.
 * @returns {{ stations: object[], sourceLabels: Record<string,string>, mode: string }}
 */
export function parsePastedSurvey(text) {
  const rows = splitPastedGrid(text);
  if (!rows.length) {
    return { stations: [], sourceLabels: {}, mode: "empty" };
  }

  let dataStart = 0;
  let headerRowIndex = -1;
  /** @type {Record<string, number>} */
  let columnMap = {};
  let mode = "header";

  /** @type {{ map: Record<string, number>, headerRowIndex: number, dataStart: number } | null} */
  let bestHeaderBlock = null;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const block = tryBuildHeaderFromRows(rows, i);
    if (!block || block.map.md === undefined) continue;
    const score = countMappedFields(block.map);
    if (
      !bestHeaderBlock ||
      score > countMappedFields(bestHeaderBlock.map) ||
      (score === countMappedFields(bestHeaderBlock.map) && score >= 6)
    ) {
      bestHeaderBlock = block;
      if (score >= 8) break;
    }
  }
  if (bestHeaderBlock && countMappedFields(bestHeaderBlock.map) >= 3) {
    columnMap = bestHeaderBlock.map;
    headerRowIndex = bestHeaderBlock.headerRowIndex;
    dataStart = bestHeaderBlock.dataStart;
    mode = "header";
  }

  if (columnMap.md === undefined) {
    mode = "positional";
    const cleanedRows = rows.map((r) => r.map(cleanCell));
    const legacy = findLegacyStartIndex(cleanedRows);
    if (legacy.headerRow) {
      columnMap = legacy.map;
      headerRowIndex = cleanedRows.findIndex((row) => rowLooksLikeHeader(row));
      dataStart = headerRowIndex + 1;
      if (dataStart < rows.length && rowLooksLikeUnits(cleanedRows[dataStart])) {
        dataStart += 1;
      }
      mode = "header";
    } else {
      let blockStart = legacy.mdIdx;
      for (const row of cleanedRows.slice(0, 20)) {
        if (rowLooksLikeHeader(row) || rowLooksLikeUnits(row) || rowLooksLikeLabelRow(row)) {
          continue;
        }
        const idx = inferFirstNumericColumn(row);
        if (idx >= 0) {
          blockStart = idx;
          break;
        }
      }
      columnMap =
        maxColumnCount(cleanedRows) >= 12
          ? geodetic12ColumnMap(blockStart)
          : legacyColumnMap(blockStart, 9);
      if (maxColumnCount(cleanedRows) >= 12) mode = "geodetic-12";
      headerRowIndex = -1;
      dataStart = 0;
      while (dataStart < rows.length) {
        const row = cleanedRows[dataStart];
        if (
          rowLooksLikeHeader(row) ||
          rowLooksLikeUnits(row) ||
          rowLooksLikeLabelRow(row)
        ) {
          dataStart += 1;
          continue;
        }
        if (isValidSurveyDataRow(row, columnMap)) break;
        dataStart += 1;
      }
    }
  }

  ({ columnMap, mode, headerRowIndex } = applyGeodetic12LayoutIfNeeded(
    rows,
    columnMap,
    headerRowIndex,
    mode
  ));

  const stations = [];
  for (let r = dataStart; r < rows.length; r++) {
    const cells = rows[r].map(cleanCell);
    if (cells.every((c) => c === "")) continue;
    if (rowLooksLikeHeader(cells) || rowLooksLikeUnits(cells) || rowLooksLikeLabelRow(cells)) {
      continue;
    }
    if (!isValidSurveyDataRow(cells, columnMap)) continue;

    const station = stationFromRow(cells, columnMap);
    if (isEmptyStation(station)) continue;

    stations.push(station);
  }

  const labelMode =
    mode === "geodetic-12"
      ? "geodetic-12"
      : mode === "header" && headerRowIndex >= 0
        ? "header"
        : "positional";

  const sourceLabels = sourceLabelsForMap(rows, columnMap, headerRowIndex, labelMode);

  return { stations, sourceLabels, mode, columnMap };
}

export function parsePastedRows(text) {
  return parsePastedSurvey(text).stations;
}
