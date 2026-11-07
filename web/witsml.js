export function normalizeForXml(value) {
  if (value === null || value === undefined) return "-999.25";
  const s = String(value).trim();
  if (s === "" || s.toUpperCase() === "N/A") return "-999.25";
  return s.replace(",", ".");
}

export function buildPlannedSurveysXml(stations, meta = {}) {
  const {
    nameWell = "Well 1",
    nameWellbore = "Borehole 1",
    trajectoryName = "Survey: Plan",
    trajectoryUid = "Survey_Plan",
  } = meta;

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

/** Parse filas pegadas desde Excel (columnas B–J o 9 columnas). */
export function parsePastedRows(text) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((c) => c.trim()));

  const stations = [];
  for (const cells of rows) {
    if (cells.every((c) => c === "")) continue;
    const isHeader =
      cells[0]?.toLowerCase() === "md" ||
      cells.some((c) => /^deg\/30m$/i.test(c));
    if (isHeader) continue;

    let md, incl, azi, tvd, mdDelta, vertSect, dls, dispNs, dispEw;
    if (cells.length >= 9) {
      [md, incl, azi, tvd, mdDelta, vertSect, dls, dispNs, dispEw] = cells.slice(0, 9);
    } else if (cells.length >= 8) {
      [md, incl, azi, tvd, mdDelta, vertSect, dls, dispNs, dispEw] = [
        cells[0],
        cells[1],
        cells[2],
        cells[3],
        cells[4],
        cells[5],
        cells[6],
        cells[7],
        "",
      ];
    } else continue;

    if (md === "" && incl === "") continue;
    stations.push({ md, incl, azi, tvd, mdDelta, vertSect, dls, dispNs, dispEw });
  }
  return stations;
}
