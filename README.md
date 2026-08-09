# aiops-triage-agent — identity & permissions layer

A working identity/permissions layer for an AI triage agent: scoped roles,
short-lived session tokens, a full audit trail, and a live console where you
can watch an allow/deny decision happen in real time — including the demo
moment where a read-only agent tries to overreach and gets denied and logged.

```bash
git clone <this repo> && cd aiops-triage-agent
./demo.sh
```

## Why this exists

Agents that act on your behalf — reading alerts, posting to Slack,
restarting services, paging on-call — shouldn't run with blanket access.
That's the exact gap most "agent does X automatically" demos skip over: no
notion of who or what is allowed to do what. This project gives the agent
scoped, auditable permissions instead of standing trust, which is the same
problem every team currently shipping autonomous agents is solving in
production.

## This isn't a pile of if/else

There is no `if identity == "readonly": ...` anywhere in this codebase.
[`policy/roles.yaml`](policy/roles.yaml) defines who can do what, as data:

```yaml
roles:
  triage-agent-readonly:
    permissions: [read_alert, read_runbook]
  triage-agent-remediator:
    permissions: [read_alert, read_runbook, post_slack_message,
                  trigger_runbook, escalate_pagerduty]
```

[`PolicyStore.check()`](app/policy.py) is one generic set-membership lookup
against that data, loaded once at startup. Adding a fifth role or a sixth
action never touches a conditional — that's the actual point: **policy is
externalized from code**, the same idea behind OPA, Casbin, or AWS IAM
policies. A hardcoded if/else version couldn't do any of the following:

- **Tokens carry no standing trust.** Every session mints a short-lived JWT
  (5 min TTL, [`app/tokens.py`](app/tokens.py)). Authorization still
  re-checks the *live* policy store by the token's identity claim rather
  than trusting the scope baked in at mint time — a policy change takes
  effect immediately, with no revocation list needed.
- **Every decision is audited, not just the denials.** Allow and deny both
  land in a structured, queryable trail
  ([`app/audit.py`](app/audit.py)) with identity, action, resource, and
  timestamp — the difference between "it blocked something" and "here's a
  record for compliance."
- **The frontend mirrors the same philosophy at a different layer.** A
  custom Redux middleware
  ([`ui/src/app/auditMiddleware.ts`](ui/src/app/auditMiddleware.ts)) logs
  every dispatched action, deliberately echoing "nothing happens silently"
  up the stack.

## Architecture

```
ui/ (React + TypeScript + Redux Toolkit)
  ActionConsole  — pick any identity + action, mint a token, fire it live
  AuditTable     — polls the backend, filterable by identity/outcome
       │  fetch, Bearer <session token>
       ▼
app/ (FastAPI)
  POST /auth/session      → mint_token()          [app/tokens.py]
  GET|POST /alerts, /runbooks, /slack, /pagerduty  [app/main.py]
       │  Depends(require_permission(action))      [app/enforcement.py]
       ▼
  PolicyStore.check(identity, action)               [app/policy.py]
       │  reads
       ▼
  policy/roles.yaml   ← the actual policy, as data
       │  every check, allow or deny
       ▼
  audit trail (stdout JSON + in-memory) → GET /audit  [app/audit.py]
```

## Quickstart

```bash
# backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000

# frontend (separate terminal)
cd ui && npm install && npm run dev
```

Then open `http://localhost:5173`, or skip straight to the narrated demo:

```bash
./demo.sh
```

## Test coverage

- **13 pytest cases** ([`tests/`](tests/)) — policy allow/deny matrix, token
  mint/expiry/tamper handling, the overreach denial scenario.
- **5 Playwright end-to-end specs** ([`ui/e2e/`](ui/e2e/)) — written
  test-first against real UX bugs found while using the app: a stranded
  session token on identity reselection, a misleading placeholder that made
  the "Attempt" button look permanently broken, and a network failure that
  used to fail silently instead of showing an error.

```bash
.venv/bin/python -m pytest tests/ -v      # backend
cd ui && npm run test:e2e                  # frontend (needs both servers up)
```

See [`TEST_CASES.md`](TEST_CASES.md) for the full manual + automated test
matrix (41 cases, 🎭 marks the ones with Playwright coverage).

## What's deliberately not production-grade yet

- **Action-level scoping only.** Permissions are per-action, not per-resource
  — a `post_slack_message` grant doesn't yet restrict *which* channel.
- **No token revocation list.** A token is valid until it expires; there's
  no way to kill one early.
- **In-memory audit store.** The dashboard's history resets on backend
  restart; the stdout JSON log is the only durable trail right now.
- **No policy-as-code engine.** `roles.yaml` is hand-authored; a real
  deployment would likely swap this for OPA, matching the original scope
  of this project.

## Identities

| Identity | Permissions |
|---|---|
| `triage-agent-readonly` | read_alert, read_runbook |
| `triage-agent-notifier` | + post_slack_message |
| `triage-agent-remediator` | + trigger_runbook, escalate_pagerduty |
| `triage-agent-admin` | all of the above |
