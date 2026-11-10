from __future__ import annotations

import os
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import quote

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.slb_auth import (
    build_authorization_url,
    email_from_tokens,
    handle_oauth_callback,
    resolve_frontend_url,
    slb_auth_required,
)
from app.session_store import clear_session, create_session, session_cookie_name
from app.slb_auth_deps import (
    _payload_from_request,
    access_token_from_request,
    require_slb_user,
    session_is_valid,
)
from app.witsml import build_planned_surveys_xml

load_dotenv()

WEB_DIR = Path(__file__).resolve().parent.parent / "web"
_COOKIE_PATH = "/"

# If DDH mounts the app under a subpath (e.g. /planned-surveys), set ROOT_PATH=/planned-surveys
_root_path = os.environ.get("ROOT_PATH", "").rstrip("/")

app = FastAPI(
    title="Planned Surveys XML",
    description="Replicates the Excel Planned surveys generator macro Convert_and_Generate_XML_UTF8.",
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
def home(request: Request) -> RedirectResponse:
    if session_is_valid(request):
        return RedirectResponse("/app", status_code=302)
    return RedirectResponse("/login", status_code=302)


@app.get("/login")
def login_page() -> FileResponse:
    return FileResponse(WEB_DIR / "login.html")


@app.get("/app")
def app_page(request: Request) -> Response:
    if not session_is_valid(request):
        return RedirectResponse("/login", status_code=302)
    return FileResponse(WEB_DIR / "index.html")


@app.get("/api")
def api_meta() -> dict[str, str]:
    links: dict[str, str] = {
        "message": "POST /api/planned-surveys/xml with station JSON (Excel columns B–J).",
        "health": "/health",
        "docs": "/docs",
        "app": "/app",
        "login": "/login",
    }
    if os.getenv("CLIENT_ID"):
        links["slb_login"] = "/api/auth/login"
        links["slb_session"] = "/api/auth/me"
    return links


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth/login")
def slb_login() -> RedirectResponse:
    try:
        url = build_authorization_url()
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return RedirectResponse(url=url, status_code=302)


@app.get("/api/auth/logout")
def slb_logout(request: Request) -> RedirectResponse:
    clear_session(request.cookies.get(session_cookie_name()))
    response = RedirectResponse(url="/login", status_code=302)
    for name in (
        session_cookie_name(),
        "slb_access_token",
        "slb_refresh_token",
        "slb_id_token",
        "slb_expires_at",
    ):
        response.delete_cookie(name, path=_COOKIE_PATH)
    return response


@app.get("/api/auth/me")
def slb_me(request: Request) -> JSONResponse:
    if not session_is_valid(request):
        return JSONResponse({"authenticated": False})
    token = access_token_from_request(request)
    if not token:
        return JSONResponse({"authenticated": False})
    session_payload = _payload_from_request(request) or {}
    id_token = str(session_payload.get("id_token", ""))
    return JSONResponse(
        {
            "authenticated": True,
            "email": email_from_tokens(token, id_token),
            "auth_required_for_xml": slb_auth_required(),
        }
    )


@app.get("/api/callback")
def slb_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
) -> Response:
    try:
        token_data = handle_oauth_callback(
            code=code,
            state=state,
            error=error,
            error_description=error_description,
        )
    except ValueError as exc:
        detail = quote(str(exc), safe="")
        return RedirectResponse(url=f"/login?error={detail}", status_code=302)
    except Exception as exc:
        detail = quote(str(exc), safe="")
        return RedirectResponse(url=f"/login?error={detail}", status_code=302)

    session_id = create_session(token_data)
    max_age = int(token_data.get("expires_in") or 3600)
    if max_age < 60:
        max_age = 3600

    response = RedirectResponse(url="/app", status_code=302)
    response.set_cookie(
        session_cookie_name(),
        session_id,
        httponly=True,
        max_age=max_age,
        samesite="lax",
        path=_COOKIE_PATH,
    )
    return response


@app.post("/api/planned-surveys/xml")
def generate_xml(
    body: GenerateRequest,
    _user: Annotated[dict[str, str], Depends(require_slb_user)],
) -> Response:
    if not body.stations:
        raise HTTPException(
            status_code=400,
            detail="At least one station is required (Excel Data sheet from row 4).",
        )

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


app.mount("/", StaticFiles(directory=WEB_DIR, html=False), name="web")
