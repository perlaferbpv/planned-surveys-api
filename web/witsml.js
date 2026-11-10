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

/** Reporte 12 cols con Closure: DeltaMD~6, VSEC~7, DLS~9, NS/EW~10–11. */
function closureReport12ColumnMap(offset = 0) {
  return {
    md: offset + 0,
    incl: offset + 1,
    azi: offset + 2,
    tvd: offset + 3,
    mdDelta: offset + 6,
    vertSect: offset + 7,
    dls: offset + 9,
    dispNs: offset + 10,
    dispEw: offset + 11,
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
    "azimuthgrid",
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

/**
 * Encabezados estándar (macro Excel, hoja Data col. B–J).
 * Tras normalizeHeaderToken: minúsculas, sin espacios ni unidades.
 */
const EXACT_HEADER_MAP = {
  md: "md",
  incl: "incl",
  azim: "azi",
  azi: "azi",
  tvd: "tvd",
  deltamd: "mdDelta",
  mddelta: "mdDelta",
  vsec: "vertSect",
  vertsect: "vertSect",
  dls: "dls",
  ns: "dispNs",
  ew: "dispEw",
  dispns: "dispNs",
  dispew: "dispEw",
};

/** Coincidencia por prefijo cuando el nombre trae sufijos o unidades pegadas. */
const HEADER_PREFIX_TO_FIELD = [
  ["measureddepth", "md"],
  ["deltamd", "mdDelta"],
  ["verticalsection", "vertSect"],
  ["azim", "azi"],
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

/** Máximo de decimales en preview y XML (como la macro Excel). */
export const MAX_DECIMAL_PLACES = 4;

/** Número de survey: hasta 4 decimales, coma → punto, sin ceros finales extra. */
export function formatSurveyDecimal(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (s === "" || s.toUpperCase() === "N/A") return s;
  const norm = s.replace(",", ".");
  if (!/^-?\d/.test(norm)) return norm;
  const n = Number(norm);
  if (!Number.isFinite(n)) return norm;
  const factor = 10 ** MAX_DECIMAL_PLACES;
  const rounded = Math.round(n * factor) / factor;
  let out = rounded.toFixed(MAX_DECIMAL_PLACES);
  out = out.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  if (out === "-0") return "0";
  return out;
}

export function formatStationDecimals(station) {
  /** @type {Record<string, string>} */
  const out = { ...station };
  for (const field of STATION_FIELDS) {
    const v = out[field];
    if (v !== "" && v != null) {
      const f = formatSurveyDecimal(v);
      if (/^-?\d/.test(String(f))) out[field] = f;
    }
  }
  return out;
}

export function normalizeForXml(value) {
  if (value === null || value === undefined) return "-999.25";
  const s = String(value).trim();
  if (s === "" || s.toUpperCase() === "N/A") return "-999.25";
  if (/^-?\d/.test(s.replace(",", "."))) return formatSurveyDecimal(s);
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

function isIgnoredHeaderToken(token) {
  if (!token) return false;
  if (IGNORED_HEADER_TOKENS.has(token)) return true;
  for (const ign of IGNORED_HEADER_TOKENS) {
    if (token.startsWith(ign)) return true;
  }
  return false;
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

function collapseKnownHeaderPhrases(line) {
  return line
    .replace(/\bAzim\s+Grid\b/gi, "AzimGrid")
    .replace(/\bAzimuth\s+Grid\b/gi, "AzimuthGrid")
    .replace(/\bAzim\b/gi, "Azim")
    .replace(/\bDelta\s+MD\b/gi, "DeltaMD")
    .replace(/\bTrue\s+Vertical\s+Depth\b/gi, "TVD")
    .replace(/\bMeasured\s+Depth\b/gi, "MD")
    .replace(/\bVertical\s+Section\b/gi, "VSEC");
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
  const headerLine = collapseKnownHeaderPhrases(line);
  const words = headerLine.trim().split(/\s+/).map(cleanCell);
  if (words.length >= 3) {
    const headerMap = buildColumnMap(words);
    if (headerMap.md !== undefined && countMappedFields(headerMap) >= 3) {
      return words;
    }
    if (rowLooksLikeUnits(words)) return words;
  }
  return parts.length ? parts : words;
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
    if (fieldForHeaderToken(token) || isIgnoredHeaderToken(token)) hits++;
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
  if (isIgnoredHeaderToken(token)) return null;
  if (token.startsWith("clos")) return null;

  const exactField = EXACT_HEADER_MAP[token];
  if (exactField) return exactField;

  for (const { field, alias } of SORTED_HEADER_ALIAS_ENTRIES) {
    if (token === alias) return field;
  }
  for (const [prefix, field] of HEADER_PREFIX_TO_FIELD) {
    if (token === prefix || token.startsWith(prefix)) return field;
  }

  if (token.startsWith("dls") || token.includes("dogleg")) return "dls";

  for (const { field, alias } of SORTED_HEADER_ALIAS_ENTRIES) {
    if (alias.length < 5) continue;
    if (token.includes(alias)) return field;
    if (token.length >= 5 && alias.length >= 5 && alias.includes(token)) return field;
  }

  if (token.includes("closur") || token.includes("closure")) return null;

  if (token.length >= 5) {
    let bestField = null;
    let bestDist = 2;
    for (const { field, alias } of SORTED_HEADER_ALIAS_ENTRIES) {
      if (alias.length < 4 || Math.abs(token.length - alias.length) > 2) continue;
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
  if (map.md === undefined) return false;
  if (countMappedFields(map) >= 3) return true;
  return false;
}

/** Quita columnas vacías a la izquierda (pegado desde columna B en Excel). */
function trimLeadingEmptyColumns(rows) {
  if (!rows.length) return rows;
  let lead = 0;
  const limit = Math.min(rows.length, 25);
  while (lead < maxColumnCount(rows) - 1) {
    let allEmpty = true;
    for (let i = 0; i < limit; i++) {
      if (cleanCell(rows[i][lead] ?? "") !== "") {
        allEmpty = false;
        break;
      }
    }
    if (!allEmpty) break;
    lead += 1;
  }
  if (lead === 0) return rows;
  return rows.map((row) => row.slice(lead));
}

function headerCellMapsToField(headerRow, columnIndex, field) {
  if (columnIndex === undefined || columnIndex < 0) return false;
  const token = normalizeHeaderToken(headerRow[columnIndex] ?? "");
  return fieldForHeaderToken(token) === field;
}

/** Corrige dls si el índice apunta a Closure u otra columna ignorada. */
function reconcileColumnMapWithHeaderRow(headerRow, map) {
  const cells = headerRow.map(cleanCell);
  const fromHeaders = buildColumnMap(cells);
  if (fromHeaders.md === undefined) return map;

  /** @type {Record<string, number>} */
  const merged = {};
  for (const field of STATION_FIELDS) {
    if (fromHeaders[field] !== undefined) merged[field] = fromHeaders[field];
    else if (map[field] !== undefined) merged[field] = map[field];
  }

  if (
    merged.dls !== undefined &&
    !headerCellMapsToField(cells, merged.dls, "dls")
  ) {
    delete merged.dls;
    if (fromHeaders.dls !== undefined) merged.dls = fromHeaders.dls;
    else {
      cells.forEach((cell, index) => {
        if (merged.dls !== undefined) return;
        if (fieldForHeaderToken(normalizeHeaderToken(cell)) === "dls") {
          merged.dls = index;
        }
      });
    }
  }

  return merged;
}

function findBestHeaderRowMap(rows) {
  /** @type {{ map: Record<string, number>, headerRowIndex: number, dataStart: number, score: number } | null} */
  let best = null;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const block = tryBuildHeaderFromRows(rows, i);
    if (!block || block.map.md === undefined) continue;
    const headerCells = rows[block.headerRowIndex].map(cleanCell);
    let score = countMappedFields(block.map);
    if (
      block.map.dls !== undefined &&
      headerCellMapsToField(headerCells, block.map.dls, "dls")
    ) {
      score += 2;
    }
    if (
      block.map.dls !== undefined &&
      !headerCellMapsToField(headerCells, block.map.dls, "dls")
    ) {
      score -= 3;
    }
    const better =
      !best ||
      score > best.score ||
      (score === best.score &&
        block.map.mdDelta !== undefined &&
        best.map.mdDelta === undefined);
    if (better) {
      best = { ...block, score, map: reconcileColumnMapWithHeaderRow(headerCells, block.map) };
    }
  }
  return best;
}

function parseNumericCell(value) {
  const s = cleanCell(value).replace(",", ".");
  if (!s || s.toUpperCase() === "N/A") return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function scoreTwelveColumnMap(rows, map) {
  let score = 0;
  let checked = 0;
  for (const row of rows) {
    const cells = row.map(cleanCell);
    if (!rowLooksLikeData(cells) || cells.length < 10) continue;
    const md = parseNumericCell(cells[map.md]);
    const mdDelta = parseNumericCell(cells[map.mdDelta]);
    const dls = parseNumericCell(cells[map.dls]);
    const closureCol = map.dls > 0 ? parseNumericCell(cells[map.dls - 1]) : NaN;
    if (Number.isFinite(md) && md > 5 && Number.isFinite(mdDelta)) {
      if (Math.abs(mdDelta - md) <= Math.max(3, md * 0.15)) score += 4;
      else if (mdDelta > 1 && mdDelta < md * 3) score += 2;
    }
    if (Number.isFinite(dls) && Math.abs(dls) < 15) score += 1;
    if (
      Number.isFinite(dls) &&
      Number.isFinite(closureCol) &&
      Number.isFinite(md) &&
      Math.abs(closureCol) < md &&
      dls >= closureCol * 2
    ) {
      score += 2;
    }
    checked += 1;
    if (checked >= 4) break;
  }
  return score;
}

function pickTwelveColumnPositionalMap(rows, offset = 0) {
  const candidates = [closureReport12ColumnMap(offset), geodetic12ColumnMap(offset)];
  let best = candidates[0];
  let bestScore = -1;
  for (const map of candidates) {
    const score = scoreTwelveColumnMap(rows, map);
    if (score > bestScore) {
      bestScore = score;
      best = map;
    }
  }
  return best;
}

function applyGeodetic12LayoutIfNeeded(rows, columnMap, headerRowIndex, mode) {
  const maxCols = maxColumnCount(rows);

  if (headerRowIndex >= 0) {
    const headerRow = rows[headerRowIndex].map(cleanCell);
    const headerMap = reconcileColumnMapWithHeaderRow(headerRow, buildColumnMap(headerRow));
    if (headerMap.md !== undefined && headerMapLooksUsable(headerMap)) {
      return { columnMap: headerMap, mode: "header", headerRowIndex };
    }
  }

  if (maxCols < 10) return { columnMap, mode, headerRowIndex };

  const offset = columnMap.md ?? 0;
  const wrongSequentialBToJ =
    columnMap.mdDelta === offset + 4 && columnMap.dls === offset + 6;
  const geodeticMdDeltaAtDlsColumn = columnMap.mdDelta === offset + 9;
  const needsTwelveColLayout =
    headerRowIndex < 0 &&
    mode !== "header" &&
    (wrongSequentialBToJ ||
      geodeticMdDeltaAtDlsColumn ||
      countMappedFields(columnMap) < 6);

  if (needsTwelveColLayout) {
    return {
      columnMap: pickTwelveColumnPositionalMap(rows, offset),
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
  let rows = splitPastedGrid(text);
  rows = trimLeadingEmptyColumns(rows);
  if (!rows.length) {
    return { stations: [], sourceLabels: {}, mode: "empty" };
  }

  let dataStart = 0;
  let headerRowIndex = -1;
  /** @type {Record<string, number>} */
  let columnMap = {};
  let mode = "header";

  const bestHeaderBlock = findBestHeaderRowMap(rows);
  if (bestHeaderBlock && bestHeaderBlock.score >= 5) {
    columnMap = bestHeaderBlock.map;
    headerRowIndex = bestHeaderBlock.headerRowIndex;
    dataStart = bestHeaderBlock.dataStart;
    mode = "header";
  } else if (bestHeaderBlock && bestHeaderBlock.score >= 3) {
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
      const wide = maxColumnCount(cleanedRows) >= 10;
      columnMap = wide
        ? pickTwelveColumnPositionalMap(cleanedRows, blockStart)
        : legacyColumnMap(blockStart, 9);
      if (wide) mode = "geodetic-12";
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

  const rescanned = findBestHeaderRowMap(rows);
  if (
    rescanned &&
    rescanned.score >= 5 &&
    (mode !== "header" || rescanned.score > countMappedFields(columnMap))
  ) {
    columnMap = rescanned.map;
    headerRowIndex = rescanned.headerRowIndex;
    dataStart = Math.max(dataStart, rescanned.dataStart);
    mode = "header";
  }

  ({ columnMap, mode, headerRowIndex } = applyGeodetic12LayoutIfNeeded(
    rows,
    columnMap,
    headerRowIndex,
    mode
  ));

  if (headerRowIndex >= 0) {
    const headerRow = rows[headerRowIndex].map(cleanCell);
    const headerOnlyMap = reconcileColumnMapWithHeaderRow(
      headerRow,
      buildColumnMap(headerRow)
    );
    if (headerOnlyMap.md !== undefined) {
      columnMap = headerOnlyMap;
      mode = "header";
    }
  }

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

    stations.push(formatStationDecimals(station));
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
