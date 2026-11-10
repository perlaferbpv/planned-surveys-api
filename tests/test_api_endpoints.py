"""HTTP tests for every FastAPI route."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from tests.conftest import make_unsigned_jwt


class TestRootAndHealth:
    def test_get_root_redirects_to_login(self, client: TestClient) -> None:
        response = client.get("/", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/login"

    def test_get_root_redirects_to_app_when_signed_in(self, client: TestClient, bearer_token: str) -> None:
        client.cookies.set("slb_access_token", bearer_token)
        response = client.get("/", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/app"

    def test_get_api_meta_includes_links(self, client: TestClient) -> None:
        response = client.get("/api")
        assert response.status_code == 200
        data = response.json()
        assert data["slb_login"] == "/api/auth/login"
        assert data["app"] == "/app"
        assert data["login"] == "/login"

    def test_login_page_html(self, client: TestClient) -> None:
        response = client.get("/login")
        assert response.status_code == 200
        assert "Sign in with SLB" in response.text
        assert "slbLogo.png" in response.text

    def test_app_requires_session(self, client: TestClient) -> None:
        response = client.get("/app", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/login"

    def test_app_serves_converter_when_signed_in(self, client: TestClient, bearer_token: str) -> None:
        client.cookies.set("slb_access_token", bearer_token)
        response = client.get("/app")
        assert response.status_code == 200
        assert "Planned surveys to xml" in response.text

    def test_get_health(self, client: TestClient) -> None:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestSlbAuthRoutes:
    def test_auth_login_redirects_to_csi(self, client: TestClient) -> None:
        response = client.get("/api/auth/login", follow_redirects=False)
        assert response.status_code == 302
        location = response.headers["location"]
        assert location.startswith("https://csi.example.test/v2/auth")
        parsed = parse_qs(urlparse(location).query)
        assert parsed["client_id"] == ["unit-test-client-id"]
        assert parsed["response_type"] == ["code"]

    def test_auth_login_missing_config_returns_500(
        self, monkeypatch: pytest.MonkeyPatch, slb_env: None
    ) -> None:
        monkeypatch.setenv("CLIENT_ID", "")
        monkeypatch.setenv("CLIENT_SECRET", "")
        from app.main import app

        with TestClient(app) as c:
            response = c.get("/api/auth/login")
        assert response.status_code == 500

    def test_auth_logout_clears_cookies(self, client: TestClient) -> None:
        client.cookies.set("slb_access_token", "old")
        response = client.get("/api/auth/logout", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == "/login"
        set_cookie = response.headers.get("set-cookie", "").lower()
        assert "slb_access_token" in set_cookie

    def test_auth_me_unauthenticated(self, client: TestClient) -> None:
        response = client.get("/api/auth/me")
        assert response.status_code == 200
        assert response.json() == {"authenticated": False}

    def test_auth_me_with_bearer(self, client: TestClient) -> None:
        token = make_unsigned_jwt({"email": "me@example.com"})
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["authenticated"] is True
        assert body["email"] == "me@example.com"
        assert body["auth_required_for_xml"] is False

    def test_callback_oauth_error_redirects_login(self, client: TestClient) -> None:
        response = client.get(
            "/api/callback",
            params={"error": "access_denied", "error_description": "User cancelled"},
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert "/login?error=" in response.headers["location"]
        assert "User%20cancelled" in response.headers["location"] or "cancelled" in response.headers["location"]

    def test_callback_invalid_state_redirects_login(self, client: TestClient) -> None:
        response = client.get(
            "/api/callback",
            params={"code": "abc", "state": "not-a-real-state"},
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert "/login?error=" in response.headers["location"]

    def test_callback_success_sets_cookies(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        login = client.get("/api/auth/login", follow_redirects=False)
        state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]

        monkeypatch.setattr(
            "app.slb_auth.exchange_authorization_code",
            lambda code, config=None: {
                "access_token": "callback-access-token",
                "refresh_token": "callback-refresh",
                "id_token": make_unsigned_jwt({"email": "oauth@example.com"}),
                "expires_in": 3600,
                "token_type": "Bearer",
            },
        )

        response = client.get(
            "/api/callback",
            params={"code": "good-code", "state": state},
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert response.headers["location"] == "/app"
        set_cookie = response.headers.get("set-cookie", "").lower()
        assert "path=/" in set_cookie
        assert "ps_session_id=" in set_cookie

        app_response = client.get("/app", follow_redirects=False)
        assert app_response.status_code == 200


class TestPlannedSurveysXml:
    def test_post_xml_returns_witsml_attachment(
        self, client: TestClient, sample_station_payload: dict
    ) -> None:
        response = client.post("/api/planned-surveys/xml", json=sample_station_payload)
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/xml")
        assert 'filename="Planned_surveys_.xml"' in response.headers.get(
            "content-disposition", ""
        )
        text = response.text
        assert text.startswith('<?xml version="1.0" encoding="UTF-8"?>')
        assert "<trajectorys" in text
        assert "tie in point" in text

    def test_post_xml_empty_stations_400(self, client: TestClient) -> None:
        response = client.post("/api/planned-surveys/xml", json={"stations": []})
        assert response.status_code == 400
        assert "station" in response.json()["detail"].lower()

    def test_post_xml_requires_auth_when_enabled(
        self, client: TestClient, sample_station_payload: dict, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("SLB_AUTH_REQUIRED", "true")
        response = client.post("/api/planned-surveys/xml", json=sample_station_payload)
        assert response.status_code == 401

    def test_post_xml_with_bearer_when_auth_required(
        self,
        client: TestClient,
        sample_station_payload: dict,
        bearer_token: str,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv("SLB_AUTH_REQUIRED", "true")
        response = client.post(
            "/api/planned-surveys/xml",
            json=sample_station_payload,
            headers={"Authorization": f"Bearer {bearer_token}"},
        )
        assert response.status_code == 200
        assert "<trajectorys" in response.text

    def test_post_xml_expired_cookie_when_auth_required(
        self, client: TestClient, sample_station_payload: dict, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("SLB_AUTH_REQUIRED", "true")
        expired = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        client.cookies.set("slb_access_token", "still-present")
        client.cookies.set("slb_expires_at", expired)
        response = client.post("/api/planned-surveys/xml", json=sample_station_payload)
        assert response.status_code == 401
        assert "expired" in response.json()["detail"].lower()
