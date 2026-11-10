"""FastAPI dependencies for SLB bearer/cookie authentication."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, Request

from app.session_store import get_session_payload, session_cookie_name
from app.slb_auth import decode_jwt_payload, email_from_tokens, is_token_expired, slb_auth_required

_COOKIE_ACCESS = "slb_access_token"
_COOKIE_ID = "slb_id_token"
_COOKIE_EXPIRES = "slb_expires_at"


def _parse_expires_cookie(raw: str) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _payload_from_request(request: Request) -> dict | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            return {"access_token": token, "id_token": ""}

    session_id = request.cookies.get(session_cookie_name(), "").strip()
    if session_id:
        return get_session_payload(session_id)

    # Legacy: full JWT stored directly in cookies (older builds)
    cookie = request.cookies.get(_COOKIE_ACCESS, "").strip()
    if cookie:
        return {
            "access_token": cookie,
            "id_token": request.cookies.get(_COOKIE_ID, ""),
            "expires_at": request.cookies.get(_COOKIE_EXPIRES, ""),
        }
    return None


def access_token_from_request(request: Request) -> str | None:
    payload = _payload_from_request(request)
    if payload is None:
        return None
    token = str(payload.get("access_token", "")).strip()
    return token or None


def session_is_valid(request: Request) -> bool:
    """True when the request has a non-expired SLB access token (session, cookie, or Bearer)."""
    payload = _payload_from_request(request)
    if payload is None or not str(payload.get("access_token", "")).strip():
        return False

    raw_expires = payload.get("expires_at")
    if raw_expires:
        try:
            expires = datetime.fromisoformat(str(raw_expires).replace("Z", "+00:00"))
            if is_token_expired(expires):
                return False
        except ValueError:
            pass

    expires_cookie = _parse_expires_cookie(request.cookies.get(_COOKIE_EXPIRES, ""))
    if expires_cookie is not None and is_token_expired(expires_cookie):
        return False

    return True


def require_slb_user(request: Request) -> dict[str, str]:
    """Validate SLB session when SLB_AUTH_REQUIRED is enabled."""
    if not slb_auth_required():
        return {}

    payload = _payload_from_request(request)
    token = str(payload.get("access_token", "") if payload else "").strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="SLB sign-in required. Open /api/auth/login or send Authorization: Bearer <token>.",
        )

    expires = _parse_expires_cookie(request.cookies.get(_COOKIE_EXPIRES, ""))
    if expires is not None and is_token_expired(expires):
        raise HTTPException(status_code=401, detail="SLB access token expired.")

    raw_expires = payload.get("expires_at") if payload else ""
    if raw_expires:
        try:
            expires_at = datetime.fromisoformat(str(raw_expires).replace("Z", "+00:00"))
            if is_token_expired(expires_at):
                raise HTTPException(status_code=401, detail="SLB access token expired.")
        except ValueError:
            pass

    claims = decode_jwt_payload(token)
    if not claims and not request.cookies.get(session_cookie_name()) and not request.cookies.get(_COOKIE_ACCESS):
        raise HTTPException(status_code=401, detail="Invalid SLB access token.")

    id_token = str(payload.get("id_token", "") if payload else "")
    email = email_from_tokens(token, id_token)
    return {"email": email, "access_token": token}
