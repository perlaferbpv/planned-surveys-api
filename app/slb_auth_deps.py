"""FastAPI dependencies for SLB bearer/cookie authentication."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, Request

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


def access_token_from_request(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            return token
    cookie = request.cookies.get(_COOKIE_ACCESS, "").strip()
    if cookie:
        return cookie
    return None


def session_is_valid(request: Request) -> bool:
    """True when the request has a non-expired SLB access token (cookie or Bearer)."""
    token = access_token_from_request(request)
    if not token:
        return False
    expires = _parse_expires_cookie(request.cookies.get(_COOKIE_EXPIRES, ""))
    if expires is not None and is_token_expired(expires):
        return False
    return True


def require_slb_user(request: Request) -> dict[str, str]:
    """Validate SLB session when SLB_AUTH_REQUIRED is enabled."""
    if not slb_auth_required():
        return {}

    token = access_token_from_request(request)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="SLB sign-in required. Open /api/auth/login or send Authorization: Bearer <token>.",
        )

    expires = _parse_expires_cookie(request.cookies.get(_COOKIE_EXPIRES, ""))
    if expires is not None and is_token_expired(expires):
        raise HTTPException(status_code=401, detail="SLB access token expired.")

    claims = decode_jwt_payload(token)
    if not claims and not request.cookies.get(_COOKIE_ACCESS):
        raise HTTPException(status_code=401, detail="Invalid SLB access token.")

    id_token = request.cookies.get(_COOKIE_ID, "")
    email = email_from_tokens(token, id_token)
    return {"email": email, "access_token": token}
