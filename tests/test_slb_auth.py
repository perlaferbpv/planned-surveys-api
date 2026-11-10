"""Unit tests for app.slb_auth (no HTTP)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.slb_auth import (
    SlbAuthConfig,
    build_authorization_url,
    email_from_tokens,
    handle_oauth_callback,
    is_token_expired,
    resolve_slb_redirect_uri,
    slb_auth_required,
)
from tests.conftest import make_unsigned_jwt


def test_resolve_slb_redirect_uri_explicit(slb_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SLB_REDIRECT_URI", "http://testserver/api/callback")
    assert resolve_slb_redirect_uri() == "http://testserver/api/callback"


def test_build_authorization_url_contains_required_params(slb_env: None) -> None:
    url = build_authorization_url()
    assert url.startswith("https://csi.example.test/v2/auth?")
    assert "client_id=unit-test-client-id" in url
    assert "redirect_uri=" in url
    assert "response_type=code" in url
    assert "state=" in url
    assert "scope=openid" in url or "scope=openid+test-scope" in url or "test-scope" in url


def test_slb_config_validate_missing_client_id(slb_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLIENT_ID", "")
    cfg = SlbAuthConfig.from_env()
    with pytest.raises(ValueError, match="CLIENT_ID"):
        cfg.validate()


def test_handle_oauth_callback_rejects_oauth_error(slb_env: None) -> None:
    with pytest.raises(ValueError, match="SLB authorization failed"):
        handle_oauth_callback(code=None, state=None, error="access_denied", error_description="Denied")


def test_handle_oauth_callback_happy_path(slb_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    url = build_authorization_url()
    state = url.split("state=")[1].split("&")[0]

    token_response = {
        "access_token": "test-access",
        "expires_in": 120,
        "token_type": "Bearer",
    }

    with patch("app.slb_auth.exchange_authorization_code", return_value=token_response):
        data = handle_oauth_callback(code="auth-code", state=state)

    assert data["access_token"] == "test-access"


def test_email_from_tokens_reads_jwt_claim() -> None:
    token = make_unsigned_jwt({"preferred_username": "user@slb.com"})
    assert email_from_tokens(token) == "user@slb.com"


def test_is_token_expired() -> None:
    from datetime import datetime, timedelta, timezone

    past = datetime.now(timezone.utc) - timedelta(seconds=1)
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    assert is_token_expired(past) is True
    assert is_token_expired(future) is False
    assert is_token_expired(None) is False


def test_slb_auth_required_flag(slb_env: None, monkeypatch: pytest.MonkeyPatch) -> None:
    assert slb_auth_required() is False
    monkeypatch.setenv("SLB_AUTH_REQUIRED", "true")
    assert slb_auth_required() is True


def test_exchange_authorization_code_uses_basic_auth(slb_env: None) -> None:
    from app.slb_auth import exchange_authorization_code

    mock_response = MagicMock()
    mock_response.json.return_value = {"access_token": "x"}
    mock_response.raise_for_status = MagicMock()

    with patch("app.slb_auth.httpx.Client") as client_cls:
        client = client_cls.return_value.__enter__.return_value
        client.post.return_value = mock_response
        result = exchange_authorization_code("code-xyz")

    assert result["access_token"] == "x"
    _, kwargs = client.post.call_args
    assert "Authorization" in kwargs["headers"]
    assert kwargs["headers"]["Authorization"].startswith("Basic ")
