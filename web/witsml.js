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

/** Nombres de cabecera aceptados (minúsculas, sin espacios). */
const HEADER_ALIASES = {
  md: ["md", "measureddepth", "depthmd", "mdm"],
  incl: ["incl", "inclination", "inc", "deviation", "incldeg"],
  azi: ["azi", "azimuth", "az", "aziang", "heading"],
  tvd: ["tvd", "trueverticaldepth", "tvdm"],
  mdDelta: ["mddelta", "mdelta", "mdchange", "dmd", "mddel"],
  vertSect: ["vertsect", "verticalsection", "vsect", "vertsection", "vs"],
  dls: ["dls", "dogleg", "doglegseverity", "dl"],
  dispNs: ["dispns", "ns", "displacementns", "northing", "deltans", "mdispns"],
  dispEw: ["dispew", "ew", "displacementew", "easting", "deltaew", "mdispew"],
};

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
    lines.push(`      <md uom="m">${normalizeForXml(md)}</md>`;
    lines.push(`      <tvd uom="m">${normalizeForXml(station.tvd)}</tvd>`);
    lines.push(`      <incl uom="deg">${normalizeForXml(station.incl)}</incl>`);
    lines.push(`      <azi uom="deg">${normalizeForXml(station.azi)}</azi>`;
    lines.push(`      <dispNs uom="m">${normalizeForXml(station.dispNs)}</dispNs>`;
    lines.push(`      <dispEw uom="m">${normalizeForXml(station.dispEw)}</dispEw>`;
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

function normalizeHeaderToken(cell) {
  if (!cell) return "";
  let s = String(cell).trim().toLowerCase();
  s = s.replace(/\(.*?\)/g, "");
  s = s.replace(/[\s_\-./\\]+/g, "");
  return s;
}

function splitPastedGrid(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const delimiter = trimmed.includes("\t") ? "\t" : ",";
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.split(delimiter).map((c) => c.trim()));
}

function fieldForHeaderToken(token) {
  if (!token) return null;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(token)) return field;
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
  const hits = cells.filter((c) => UNIT_TOKENS.has(String(c).trim().toLowerCase()));
  return hits.length >= Math.min(4, Math.ceil(cells.length * 0.4));
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
    station[field] = idx !== undefined ? (cells[idx] ?? "").trim() : "";
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

/**
 * Interpreta pegado desde Excel/CSV: columnas desordenadas y columnas extra.
 * Busca cabeceras por nombre en las primeras filas; si no hay, usa bloque B–J contiguo.
 */
export function parsePastedRows(text) {
  const rows = splitPastedGrid(text);
  if (!rows.length) return [];

  let dataStart = 0;
  /** @type {Record<string, number>} */
  let columnMap = {};

  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    if (!rowLooksLikeHeader(rows[i])) continue;
    columnMap = buildColumnMap(rows[i]);
    dataStart = i + 1;
    if (dataStart < rows.length && rowLooksLikeUnits(rows[dataStart])) {
      dataStart += 1;
    }
    break;
  }

  if (columnMap.md === undefined) {
    const legacy = findLegacyStartIndex(rows);
    if (legacy.headerRow) {
      columnMap = legacy.map;
      const headerIdx = rows.findIndex((row) => rowLooksLikeHeader(row));
      dataStart = headerIdx + 1;
      if (dataStart < rows.length && rowLooksLikeUnits(rows[dataStart])) {
        dataStart += 1;
      }
    } else {
      let blockStart = legacy.mdIdx;
      for (const row of rows.slice(0, 15)) {
        if (rowLooksLikeHeader(row) || rowLooksLikeUnits(row)) continue;
        const idx = inferFirstNumericColumn(row);
        if (idx >= 0) {
          blockStart = idx;
          break;
        }
      }
      columnMap = legacyColumnMap(blockStart, 9);
      dataStart = 0;
      while (
        dataStart < rows.length &&
        (rowLooksLikeHeader(rows[dataStart]) || rowLooksLikeUnits(rows[dataStart]))
      ) {
        dataStart += 1;
      }
    }
  }

  const stations = [];
  for (let r = dataStart; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.every((c) => c === "")) continue;
    if (rowLooksLikeHeader(cells) || rowLooksLikeUnits(cells)) continue;

    const station = stationFromRow(cells, columnMap);
    if (isEmptyStation(station)) continue;
    if (station.md === "" && station.incl === "" && station.tvd === "") continue;

    stations.push(station);
  }

  return stations;
}
