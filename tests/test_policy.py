import json
import logging

from fastapi.testclient import TestClient

from app.audit import audit_logger
from app.main import app
from app.policy import policy_store

client = TestClient(app)


def test_readonly_identity_can_read_alert():
    assert policy_store.is_allowed("triage-agent-readonly", "read_alert") is True


def test_readonly_identity_cannot_trigger_runbook():
    assert policy_store.is_allowed("triage-agent-readonly", "trigger_runbook") is False


def test_unknown_identity_has_no_permissions():
    assert policy_store.is_allowed("some-random-identity", "read_alert") is False


def test_remediator_can_trigger_runbook_endpoint():
    resp = client.post(
        "/runbooks/restart-service/trigger",
        headers={"X-Agent-Identity": "triage-agent-remediator"},
    )
    assert resp.status_code == 200
    assert resp.json()["triggered_by"] == "triage-agent-remediator"


def test_overreach_readonly_agent_denied_trigger_runbook(caplog):
    """Demo scenario: a read-only agent tries to trigger remediation and is denied + logged."""
    resp = client.post(
        "/runbooks/restart-service/trigger",
        headers={"X-Agent-Identity": "triage-agent-readonly"},
    )
    assert resp.status_code == 403
    assert "not permitted" in resp.json()["detail"]


def test_denied_check_is_logged(caplog):
    # audit_logger has propagate=False, so attach caplog's handler directly.
    audit_logger.addHandler(caplog.handler)
    try:
        with caplog.at_level(logging.INFO, logger="audit"):
            policy_store.check(
                "triage-agent-readonly", "trigger_runbook", resource="restart-service"
            )
    finally:
        audit_logger.removeHandler(caplog.handler)

    record = json.loads(caplog.records[-1].message)
    assert record["identity"] == "triage-agent-readonly"
    assert record["action"] == "trigger_runbook"
    assert record["allowed"] is False
