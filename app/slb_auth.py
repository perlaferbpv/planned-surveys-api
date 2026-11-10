"""SLB / DELFI OAuth helpers (CSI authorization + token exchange)."""

from __future__ import annotations

import base64
import json
import os
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx

_PENDING_OAUTH_STATES: dict[str, float] = {}
_STATE_TTL_SECONDS = 600


@dataclass(frozen=True)
class SlbAuthConfig:
    client_id: str
    client_secret: str
    app_key: str
    authorization_url: str
    token_url: str
    redirect_uri: str
    scopes: str
    token_client_auth: str

    @classmethod
    def from_env(cls) -> SlbAuthConfig:
        scopes = os.getenv("SLB_SCOPES", "openid").strip().strip('"').strip("'")
        return cls(
            client_id=os.getenv("CLIENT_ID", "").strip(),
            client_secret=os.getenv("CLIENT_SECRET", "").strip(),
            app_key=os.getenv("APP_KEY", "").strip(),
            authorization_url=os.getenv(
                "SLB_AUTHORIZATION_URL",
                "https://csi.slb.com/v2/auth",
            ).strip(),
            token_url=os.getenv("SLB_TOKEN_URL", "https://csi.slb.com/v2/token").strip(),
            redirect_uri=resolve_slb_redirect_uri(),
            scopes=scopes,
            token_client_auth=os.getenv("SLB_TOKEN_CLIENT_AUTH", "basic")
            .strip()
            .lower(),
        )

    def validate(self) -> None:
        missing = [
            name
            for name, value in (
                ("CLIENT_ID", self.client_id),
                ("CLIENT_SECRET", self.client_secret),
                ("SLB_REDIRECT_URI", self.redirect_uri),
            )
            if not value
        ]
        if missing:
            joined = ", ".join(missing)
            raise ValueError(f"Missing required SLB auth environment variable(s): {joined}")


def resolve_slb_redirect_uri() -> str:
    explicit = os.getenv("SLB_REDIRECT_URI", "").strip()
    if explicit:
        return explicit
    root = os.getenv("APP_BASE_URL", "http://127.0.0.1:8000").strip().rstrip("/")
    return f"{root}/api/callback"


def resolve_frontend_url() -> str:
    explicit = os.getenv("APP_FRONTEND_URL", "").strip()
    if explicit:
        return explicit.rstrip("/")
    redirect = os.getenv("SLB_REDIRECT_URI", "").strip()
    if redirect:
        from urllib.parse import urlparse

        parsed = urlparse(redirect)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return os.getenv("APP_BASE_URL", "http://localhost:8000").strip().rstrip("/")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def is_token_expired(expires_at: datetime | None) -> bool:
    if expires_at is None:
        return False
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = expires_at.astimezone(timezone.utc)
    return expires_at <= _utcnow()


def _remember_state(state: str) -> None:
    now = time.time()
    expired = [
        key
        for key, created_at in _PENDING_OAUTH_STATES.items()
        if now - created_at > _STATE_TTL_SECONDS
    ]
    for key in expired:
        _PENDING_OAUTH_STATES.pop(key, None)
    _PENDING_OAUTH_STATES[state] = now


def _validate_state(state: str | None) -> None:
    if not state:
        raise ValueError("Missing OAuth state parameter.")
    created_at = _PENDING_OAUTH_STATES.pop(state, None)
    if created_at is None:
        raise ValueError("Invalid or expired OAuth state.")
    if time.time() - created_at > _STATE_TTL_SECONDS:
        raise ValueError("OAuth state expired.")


def build_authorization_url(config: SlbAuthConfig | None = None) -> str:
    cfg = config or SlbAuthConfig.from_env()
    cfg.validate()
    state = secrets.token_urlsafe(24)
    _remember_state(state)
    query = urlencode(
        {
            "client_id": cfg.client_id,
            "redirect_uri": cfg.redirect_uri,
            "response_type": "code",
            "response_mode": "query",
            "scope": cfg.scopes,
            "state": state,
        }
    )
    return f"{cfg.authorization_url}?{query}"


def _basic_auth_header(client_id: str, client_secret: str) -> str:
    token = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    return f"Basic {token}"


def exchange_authorization_code(
    code: str,
    config: SlbAuthConfig | None = None,
) -> dict[str, Any]:
    cfg = config or SlbAuthConfig.from_env()
    cfg.validate()
    if not code:
        raise ValueError("Missing authorization code.")

    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": cfg.redirect_uri,
    }

    if cfg.token_client_auth == "basic":
        headers["Authorization"] = _basic_auth_header(cfg.client_id, cfg.client_secret)
    else:
        data["client_id"] = cfg.client_id
        data["client_secret"] = cfg.client_secret

    with httpx.Client(timeout=30.0) as client:
        response = client.post(cfg.token_url, data=data, headers=headers)
        response.raise_for_status()
        return response.json()


def handle_oauth_callback(
    code: str | None,
    state: str | None,
    error: str | None = None,
    error_description: str | None = None,
) -> dict[str, Any]:
    if error:
        detail = error_description or error
        raise ValueError(f"SLB authorization failed: {detail}")
    if not code:
        raise ValueError("Missing authorization code in callback.")
    _validate_state(state)
    token_data = exchange_authorization_code(code)
    if not token_data.get("access_token"):
        raise ValueError("Token response did not include access_token.")
    return token_data


def token_expires_at(token_data: dict[str, Any]) -> datetime | None:
    expires_in = token_data.get("expires_in")
    if expires_in is None:
        return None
    try:
        return _utcnow() + timedelta(seconds=int(expires_in))
    except (TypeError, ValueError):
        return None


def token_payload_from_response(token_data: dict[str, Any]) -> dict[str, Any]:
    expires = token_expires_at(token_data)
    return {
        "access_token": str(token_data.get("access_token", "")),
        "refresh_token": str(token_data.get("refresh_token", "") or ""),
        "id_token": str(token_data.get("id_token", "") or ""),
        "token_type": str(token_data.get("token_type", "Bearer")),
        "scope": str(token_data.get("scope", "")),
        "expires_at": expires.isoformat() if expires else "",
    }


def decode_jwt_payload(token: str) -> dict[str, Any]:
    if not token:
        return {}
    parts = token.split(".")
    if len(parts) != 3:
        return {}
    segment = parts[1]
    padding = "=" * (-len(segment) % 4)
    try:
        decoded = base64.urlsafe_b64decode(segment + padding)
        payload = json.loads(decoded)
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


_EMAIL_CLAIM_KEYS = ("email", "preferred_username", "upn", "unique_name", "mail")


def _claim_value(claims: dict[str, Any], keys: tuple[str, ...]) -> str:
    for key in keys:
        value = claims.get(key)
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned:
                return cleaned
    for nested_key in ("user", "profile", "context", "userContext"):
        nested = claims.get(nested_key)
        if isinstance(nested, dict):
            found = _claim_value(nested, keys)
            if found:
                return found
    return ""


def email_from_tokens(access_token: str, id_token: str = "") -> str:
    for token in (access_token, id_token):
        claims = decode_jwt_payload(token)
        if not claims:
            continue
        email = _claim_value(claims, _EMAIL_CLAIM_KEYS)
        if email and "@" in email:
            return email
    return ""


def slb_auth_required() -> bool:
    return os.getenv("SLB_AUTH_REQUIRED", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
