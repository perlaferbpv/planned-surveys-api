from __future__ import annotations

from typing import Any


def normalize_for_xml(value: Any) -> str:
    if value is None:
        return "-999.25"
    if isinstance(value, str):
        trimmed = value.strip().upper()
        if trimmed in ("N/A", ""):
            return "-999.25"
        return value.replace(",", ".")
    if isinstance(value, float) and value != value:
        return "-999.25"
    return str(value).replace(",", ".")


def _field(station: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in station:
            return station[key]
    return None


def build_planned_surveys_xml(
    stations: list[dict[str, Any]],
    *,
    name_well: str = "Well 1",
    name_wellbore: str = "Borehole 1",
    trajectory_name: str = "Survey: Plan",
    trajectory_uid: str = "Survey_Plan",
) -> str:
    lines: list[str] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<trajectorys xmlns="http://www.witsml.org/schemas/131" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xsi:schemaLocation="http://www.witsml.org/schemas/131 '
        'http://www.witsml.org/schemas/131/obj_trajectory.xsd" '
        'version="1.3.1.1">',
        f'  <trajectory uid="{trajectory_uid}">',
        f"    <nameWell>{name_well}</nameWell>",
        f"    <nameWellbore>{name_wellbore}</nameWellbore>",
        f"    <name>{trajectory_name}</name>",
    ]

    for index, station in enumerate(stations):
        md = _field(station, "md", "MD")
        uid = normalize_for_xml(md)
        station_type = "tie in point" if index == 0 else "unknown"

        lines.extend(
            [
                f'    <trajectoryStation uid="{uid}">',
                f"      <typeTrajStation>{station_type}</typeTrajStation>",
                f'      <md uom="m">{normalize_for_xml(md)}</md>',
                f'      <tvd uom="m">{normalize_for_xml(_field(station, "tvd", "TVD"))}</tvd>',
                f'      <incl uom="deg">{normalize_for_xml(_field(station, "incl", "INCL"))}</incl>',
                f'      <azi uom="deg">{normalize_for_xml(_field(station, "azi", "AZI"))}</azi>',
                f'      <dispNs uom="m">{normalize_for_xml(_field(station, "dispNs", "disp_ns"))}</dispNs>',
                f'      <dispEw uom="m">{normalize_for_xml(_field(station, "dispEw", "disp_ew"))}</dispEw>',
                f'      <vertSect uom="m">{normalize_for_xml(_field(station, "vertSect", "vert_sect"))}</vertSect>',
                f'      <dls uom="deg/30m">{normalize_for_xml(_field(station, "dls", "DLS"))}</dls>',
                f'      <mdDelta uom="m">{normalize_for_xml(_field(station, "mdDelta", "md_delta"))}</mdDelta>',
                "    </trajectoryStation>",
            ]
        )

    lines.extend(
        [
            "    <commonData>",
            "      <itemState>plan</itemState>",
            "    </commonData>",
            "  </trajectory>",
            "</trajectorys>",
        ]
    )

    return "\n".join(lines) + "\n"
