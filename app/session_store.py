"""Server-side SLB session storage (small browser cookie, avoids huge JWT cookies)."""

from __future__ import annotations

import secrets
import time
from datetime import datetime, timezone
from typing import Any

from app.slb_auth import is_token_expired, token_payload_from_response

_SESSION_COOKIE = "ps_session_id"
_SESSION_TTL_SECONDS = 60 * 60 * 12
_sessions: dict[str, dict[str, Any]] = {}


def session_cookie_name() -> str:
    return _SESSION_COOKIE


def _cleanup() -> None:
    now = time.time()
    expired = [sid for sid, row in _sessions.items() if now - row["created_at"] > _SESSION_TTL_SECONDS]
    for sid in expired:
        _sessions.pop(sid, None)


def create_session(token_data: dict[str, Any]) -> str:
    _cleanup()
    sid = secrets.token_urlsafe(24)
    payload = token_payload_from_response(token_data)
    _sessions[sid] = {
        "created_at": time.time(),
        "payload": payload,
    }
    return sid


def clear_session(session_id: str | None) -> None:
    if session_id:
        _sessions.pop(session_id, None)


def get_session_payload(session_id: str | None) -> dict[str, Any] | None:
    if not session_id:
        return None
    row = _sessions.get(session_id)
    if row is None:
        return None
    if time.time() - row["created_at"] > _SESSION_TTL_SECONDS:
        _sessions.pop(session_id, None)
        return None
    payload = row.get("payload") or {}
    raw_expires = payload.get("expires_at")
    if raw_expires:
        try:
            expires = datetime.fromisoformat(str(raw_expires).replace("Z", "+00:00"))
            if is_token_expired(expires):
                _sessions.pop(session_id, None)
                return None
        except ValueError:
            pass
    return payload
