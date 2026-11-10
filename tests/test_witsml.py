"""Unit tests for WITSML builder (supports XML endpoint)."""

from __future__ import annotations

from app.witsml import build_planned_surveys_xml, normalize_for_xml


def test_normalize_for_xml_na_and_comma() -> None:
    assert normalize_for_xml(None) == "-999.25"
    assert normalize_for_xml("N/A") == "-999.25"
    assert normalize_for_xml("1,5") == "1.5"


def test_build_planned_surveys_xml_first_station_tie_in() -> None:
    xml = build_planned_surveys_xml([{"md": 0, "tvd": 0, "incl": 0, "azi": 0}])
    assert 'typeTrajStation>tie in point<' in xml
    assert "<itemState>plan</itemState>" in xml
