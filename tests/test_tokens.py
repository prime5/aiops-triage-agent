import time

import jwt
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.tokens import ALGORITHM, SECRET_KEY, decode_token, mint_token

client = TestClient(app)


def test_mint_and_decode_roundtrip():
    token = mint_token("triage-agent-remediator")
    payload = decode_token(token)
    assert payload["sub"] == "triage-agent-remediator"
    assert "trigger_runbook" in payload["scope"]


def test_expired_token_rejected():
    token = mint_token("triage-agent-remediator", ttl_seconds=-1)
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_token(token)


def test_tampered_token_rejected():
    token = mint_token("triage-agent-remediator")
    tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
    with pytest.raises(jwt.InvalidTokenError):
        decode_token(tampered)


def test_session_endpoint_mints_usable_token():
    resp = client.post("/auth/session", params={"identity": "triage-agent-remediator"})
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    call = client.post(
        "/runbooks/restart-service/trigger",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert call.status_code == 200


def test_session_endpoint_rejects_unknown_identity():
    resp = client.post("/auth/session", params={"identity": "not-a-real-role"})
    assert resp.status_code == 404


def test_expired_token_denied_at_endpoint():
    token = jwt.encode(
        {"sub": "triage-agent-remediator", "scope": [], "iat": 0, "exp": int(time.time()) - 10},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )
    resp = client.post(
        "/runbooks/restart-service/trigger",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"]


def test_missing_auth_header_rejected():
    resp = client.get("/alerts/123")
    assert resp.status_code in (401, 422)
