from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field

from app.witsml import build_planned_surveys_xml

# Si DDH monta la app bajo un subpath (p. ej. /planned-surveys), define ROOT_PATH=/planned-surveys
_root_path = os.environ.get("ROOT_PATH", "").rstrip("/")

app = FastAPI(
    title="Planned Surveys XML",
    description="Replica la macro Convert_and_Generate_XML_UTF8 del Excel Planned surveys generator.",
    version="1.0.0",
    root_path=_root_path,
)


class TrajectoryMeta(BaseModel):
    name_well: str = "Well 1"
    name_wellbore: str = "Borehole 1"
    trajectory_name: str = "Survey: Plan"
    trajectory_uid: str = "Survey_Plan"


class SurveyStation(BaseModel):
    md: float | str
    incl: float | str | None = None
    azi: float | str | None = None
    tvd: float | str | None = None
    md_delta: float | str | None = Field(default=None, alias="mdDelta")
    vert_sect: float | str | None = Field(default=None, alias="vertSect")
    dls: float | str | None = None
    disp_ns: float | str | None = Field(default=None, alias="dispNs")
    disp_ew: float | str | None = Field(default=None, alias="dispEw")

    model_config = {"populate_by_name": True}


class GenerateRequest(BaseModel):
    stations: list[SurveyStation]
    meta: TrajectoryMeta | None = None


@app.get("/")
def index() -> dict[str, str]:
    return {
        "message": "POST /api/planned-surveys/xml con JSON de estaciones (columnas B–J del Excel).",
        "health": "/health",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/planned-surveys/xml")
def generate_xml(body: GenerateRequest) -> Response:
    if not body.stations:
        raise HTTPException(status_code=400, detail="Se requiere al menos una estación (fila 4 en adelante).")

    meta = body.meta or TrajectoryMeta()
    station_dicts: list[dict[str, Any]] = [
        s.model_dump(by_alias=True, exclude_none=False) for s in body.stations
    ]

    xml_text = build_planned_surveys_xml(
        station_dicts,
        name_well=meta.name_well,
        name_wellbore=meta.name_wellbore,
        trajectory_name=meta.trajectory_name,
        trajectory_uid=meta.trajectory_uid,
    )

    return Response(
        content=xml_text.encode("utf-8"),
        media_type="application/xml; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="Planned_surveys_.xml"'},
    )
