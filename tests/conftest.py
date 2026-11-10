"""Shared pytest fixtures (isolated env, TestClient)."""

from __future__ import annotations

import base64
import json

import pytest
from fastapi.testclient import TestClient


def make_unsigned_jwt(payload: dict) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none"}).encode()).decode().rstrip("=")
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"{header}.{body}.sig"


@pytest.fixture
def slb_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Minimal SLB OAuth env for tests (no real secrets)."""
    monkeypatch.setenv("CLIENT_ID", "unit-test-client-id")
    monkeypatch.setenv("CLIENT_SECRET", "unit-test-client-secret")
    monkeypatch.setenv("APP_KEY", "unit-test-app-key")
    monkeypatch.setenv("SLB_REDIRECT_URI", "http://testserver/api/callback")
    monkeypatch.setenv("SLB_SCOPES", "openid test-scope")
    monkeypatch.setenv("SLB_AUTHORIZATION_URL", "https://csi.example.test/v2/auth")
    monkeypatch.setenv("SLB_TOKEN_URL", "https://csi.example.test/v2/token")
    monkeypatch.setenv("APP_FRONTEND_URL", "http://testserver")
    monkeypatch.delenv("SLB_AUTH_REQUIRED", raising=False)


@pytest.fixture
def client(slb_env: None) -> TestClient:
    from app.main import app

    return TestClient(app)


@pytest.fixture
def sample_station_payload() -> dict:
    return {
        "stations": [
            {
                "md": 0,
                "incl": 0,
                "azi": 0,
                "tvd": 0,
                "mdDelta": "-999.25",
                "vertSect": 0,
                "dls": "-999.25",
                "dispNs": 0,
                "dispEw": 0,
            },
            {
                "md": 10,
                "incl": 0,
                "azi": 87,
                "tvd": 10,
                "mdDelta": 10,
                "vertSect": 0,
                "dls": 0,
                "dispNs": 0,
                "dispEw": 0,
            },
        ],
        "meta": {
            "name_well": "Well 1",
            "name_wellbore": "Borehole 1",
        },
    }


@pytest.fixture
def bearer_token() -> str:
    return make_unsigned_jwt({"email": "tester@example.com", "sub": "user-123"})
