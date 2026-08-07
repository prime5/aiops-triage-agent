"""Action layer for the triage agent, gated by identity/permission checks."""

import os

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.audit import get_recent_audit_records
from app.enforcement import require_permission
from app.policy import policy_store
from app.tokens import mint_token

app = FastAPI(title="aiops-triage-agent")

_dev_origin = os.environ.get("TRIAGE_UI_ORIGIN", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_dev_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/auth/session")
def create_session_token(identity: str):
    """Mint a short-lived, scoped token for one triage session."""
    if identity not in policy_store.roles:
        raise HTTPException(status_code=404, detail=f"unknown identity '{identity}'")
    return {"access_token": mint_token(identity), "token_type": "bearer"}


@app.get("/policy/roles")
def list_roles():
    return {role: sorted(perms) for role, perms in policy_store.roles.items()}


@app.get("/audit")
def list_audit_records(limit: int = 200):
    return get_recent_audit_records(limit=limit)


@app.get("/alerts/{alert_id}")
def read_alert(alert_id: str, identity: str = Depends(require_permission("read_alert"))):
    return {"alert_id": alert_id, "identity": identity}


@app.get("/runbooks/{runbook_id}")
def read_runbook(runbook_id: str, identity: str = Depends(require_permission("read_runbook"))):
    return {"runbook_id": runbook_id, "identity": identity}


@app.post("/slack/message")
def post_slack_message(
    channel: str, text: str, identity: str = Depends(require_permission("post_slack_message"))
):
    return {"channel": channel, "text": text, "identity": identity}


@app.post("/runbooks/{runbook_id}/trigger")
def trigger_runbook(
    runbook_id: str, identity: str = Depends(require_permission("trigger_runbook"))
):
    return {"runbook_id": runbook_id, "triggered_by": identity}


@app.post("/pagerduty/escalate")
def escalate_pagerduty(
    incident_id: str, identity: str = Depends(require_permission("escalate_pagerduty"))
):
    return {"incident_id": incident_id, "escalated_by": identity}
