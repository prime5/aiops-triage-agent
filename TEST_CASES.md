# Test Cases — Identity & Permissions Layer

Manual + exploratory test matrix for the policy engine, token lifecycle, API
contracts, and the access-control console UI. Run against a local instance:

```bash
cd ~/code/aiops-triage-agent
.venv/bin/uvicorn app.main:app --port 8000          # terminal 1
cd ui && npm run dev                                 # terminal 2
```

A handful of the P2 — UI interaction cases (marked 🎭 below) have Playwright
coverage in `ui/e2e/`. With both servers above running:

```bash
cd ui
npm run test:e2e        # headless, CI-style
npm run test:e2e:ui     # interactive runner, good for writing/debugging new specs
```

**Status legend:** ☐ Not run · ✅ Pass · ❌ Fail · ⛔ Blocked · 🎭 Automated (Playwright)

Update the Status column as you run these — this file is meant to be edited
in place, not regenerated each time.

---

## P0 — Core policy enforcement (the allow/deny matrix)

| ID | Steps | Expected | Status |
|---|---|---|---|
| TC-01 | Mint token for `triage-agent-readonly`, `GET /alerts/42` | 200, audit log shows `allowed: true` | ☐ |
| TC-02 | Same identity, `GET /runbooks/restart-service` | 200, allowed | ☐ |
| TC-03 | Same identity, `POST /runbooks/restart-service/trigger` | **403**, `allowed: false` — this is the overreach demo | ☐ |
| TC-04 | Same identity, `POST /pagerduty/escalate?incident_id=INC-1` | 403, denied | ☐ |
| TC-05 | Same identity, `POST /slack/message?channel=%23x&text=hi` | 403, denied | ☐ |
| TC-06 | Mint token for `triage-agent-notifier`, post a Slack message | 200, allowed | ☐ |
| TC-07 | Same identity, attempt `trigger_runbook` | 403, denied (notifier can't remediate) | ☐ |
| TC-08 | Mint token for `triage-agent-remediator`, trigger a runbook | 200, allowed | ☐ |
| TC-09 | Same identity, escalate to PagerDuty | 200, allowed | ☐ |
| TC-10 | Mint token for `triage-agent-admin`, run all 5 actions | All 200 | ☐ |
| TC-11 | For every denial above, confirm the audit record's `action` and `identity` match exactly what was attempted | No mislabeled records | ☐ |

## P1 — Token lifecycle & security edge cases

| ID | Steps | Expected | Status |
|---|---|---|---|
| TC-12 | `POST /auth/session?identity=not-a-real-role` | 404 `unknown identity` | ☐ |
| TC-13 | Call a protected endpoint with no `Authorization` header | 401 or 422 (missing required header) | ☐ |
| TC-14 | Call with `Authorization: NotBearer abc123` | 401, "expected 'Authorization: Bearer <token>'" | ☐ |
| TC-15 | Call with a syntactically valid but tampered JWT (flip one char) | 401 "invalid session token" | ☐ |
| TC-16 | Call with a token minted >5 min ago (default TTL) | 401 "session token expired" | ☐ |
| TC-17 | Mint a `readonly` token, then edit `policy/roles.yaml` to add `trigger_runbook` to it *without restarting the server*, retry the same call | Still 403 — proves policy is re-checked live via `PolicyStore`, not cached in-process unless reloaded (note: current `PolicyStore` loads once at startup, so this should actually stay static until restart — good case for confirming that assumption explicitly) | ☐ |
| TC-18 | Reuse the same valid token for two different actions it's scoped for | Both succeed — token isn't single-use | ☐ |

## P1 — API contracts

| ID | Steps | Expected | Status |
|---|---|---|---|
| TC-19 | `GET /policy/roles` | Returns all 4 identities with correct, sorted permission lists | ☐ |
| TC-20 | `GET /audit` with no params | Returns up to 200 most recent records, newest first | ☐ |
| TC-21 | `GET /audit?limit=1` | Returns exactly 1 record (the most recent) | ☐ |
| TC-22 | Generate >500 audit events, then `GET /audit?limit=500` | Returns 500 — oldest ones evicted from the in-memory deque | ☐ |
| TC-23 | Cross-origin request from an origin other than the configured `TRIAGE_UI_ORIGIN` | Blocked by CORS (check browser console, not curl — curl ignores CORS) | ☐ |

## P2 — UI interaction

*Requires the browser console at `ui/` — not curl-testable (TC-23 above is also
browser-only, since curl ignores CORS).*

| ID | Steps | Expected | Status |
|---|---|---|---|
| TC-24 | Load the console fresh | Identity dropdown populated from live `/policy/roles`, not hardcoded | ☐ |
| TC-25 | Change identity in the console | New token auto-minted; "session token ready" text updates; scope hint line updates | 🎭* |
| TC-26 | Change only the action (identity unchanged) | Existing token is reused — no redundant `/auth/session` call (check Network tab) | ☐ |
| TC-27 | Select an action, leave a required field blank | "Attempt" button stays disabled | 🎭 |
| TC-28 | Fire an allowed action | Green ribbon, "ALLOWED", correct status code and JSON body shown | 🎭 |
| TC-29 | Fire the overreach case from the console | Red ribbon, "DENIED", 403 body shown verbatim | 🎭 |
| TC-30 | After firing an action, watch the audit table without touching it | New row appears within ~1.5s (polling), no manual refresh | ☐ |
| TC-31 | Filter audit table by identity | Only that identity's rows shown | ☐ |
| TC-32 | Filter audit table by "Denied only" | Only 403 rows shown | ☐ |
| TC-33 | Combine both filters (identity + denied) | Intersection only | ☐ |
| TC-34 | Clear all filters | Full list returns | ☐ |
| TC-35 | Switch actions rapidly | Previous result/ribbon clears; no stale result shown for the new action | ☐ |
| TC-36 | Open browser devtools console during any action attempt | `[redux-audit]` log line appears for every dispatched action, including RTK Query internals | ☐ |
| TC-37 | Resize to a narrow viewport (mobile width) | Two-column layout collapses to one column, no horizontal scroll | ☐ |
| TC-38 | Toggle OS/browser dark ↔ light mode | Page re-themes without a broken-contrast flash | ☐ |

\* The 🎭 spec for TC-25 (`ui/e2e/action-console.spec.ts`) only covers the
edge case of reselecting the *already-active* identity — found while
diagnosing TC-28, this used to silently strand the session token (fixed in
`sessionSlice.ts`). The general "switch to a different identity" flow, and
the scope-hint text update, are still manual.

## P2 — Resilience / negative

*TC-39 and TC-41 are exercised through the UI; TC-40 is backend state observed
through the UI's next poll.*

| ID | Steps | Expected | Status |
|---|---|---|---|
| TC-39 | Stop the backend, then click "Attempt" in the UI | Fails gracefully: console stays up, a visible `.attempt-error` message explains the failure, button re-enables | 🎭 |
| TC-40 | Restart the backend mid-session | In-memory audit history resets to empty; UI should reflect that on next poll, not error | ☐ |
| TC-41 | Submit an action with special characters in a free-text field (e.g. Slack message text with `<script>` or unicode) | No crash, value passed through as literal text (no injection into rendered HTML) | ☐ |

---

*41 cases: 11 P0, 12 P1, 15 P2, 3 resilience. P0 is the demo path — run those first before showing anyone the app.*

---

## Curl commands (P0 + P1, the API-testable cases)

Base URL `http://localhost:8000`; `jq` is used to pull tokens out of responses.

```bash
# TC-01–03: readonly identity — reads pass, trigger_runbook is the overreach demo
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/session?identity=triage-agent-readonly" | jq -r .access_token)
curl -s -i http://localhost:8000/alerts/42 -H "Authorization: Bearer $TOKEN"                                # TC-01: 200
curl -s -i http://localhost:8000/runbooks/restart-service -H "Authorization: Bearer $TOKEN"                 # TC-02: 200
curl -s -i -X POST http://localhost:8000/runbooks/restart-service/trigger -H "Authorization: Bearer $TOKEN" # TC-03: 403

# TC-04–05: readonly denied for pagerduty/slack
curl -s -i -X POST "http://localhost:8000/pagerduty/escalate?incident_id=INC-1" -H "Authorization: Bearer $TOKEN"  # 403
curl -s -i -X POST "http://localhost:8000/slack/message?channel=%23x&text=hi" -H "Authorization: Bearer $TOKEN"   # 403

# TC-06–07: notifier — slack ok, trigger_runbook denied
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/session?identity=triage-agent-notifier" | jq -r .access_token)
curl -s -i -X POST "http://localhost:8000/slack/message?channel=%23incidents&text=hello" -H "Authorization: Bearer $TOKEN"  # 200
curl -s -i -X POST http://localhost:8000/runbooks/restart-service/trigger -H "Authorization: Bearer $TOKEN"                # 403

# TC-08–09: remediator — trigger + escalate both ok
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/session?identity=triage-agent-remediator" | jq -r .access_token)
curl -s -i -X POST http://localhost:8000/runbooks/restart-service/trigger -H "Authorization: Bearer $TOKEN"       # 200
curl -s -i -X POST "http://localhost:8000/pagerduty/escalate?incident_id=INC-1" -H "Authorization: Bearer $TOKEN" # 200

# TC-10: admin — all 5 actions
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/session?identity=triage-agent-admin" | jq -r .access_token)
curl -s -i http://localhost:8000/alerts/42 -H "Authorization: Bearer $TOKEN"
curl -s -i http://localhost:8000/runbooks/restart-service -H "Authorization: Bearer $TOKEN"
curl -s -i -X POST "http://localhost:8000/slack/message?channel=%23incidents&text=hello" -H "Authorization: Bearer $TOKEN"
curl -s -i -X POST http://localhost:8000/runbooks/restart-service/trigger -H "Authorization: Bearer $TOKEN"
curl -s -i -X POST "http://localhost:8000/pagerduty/escalate?incident_id=INC-1" -H "Authorization: Bearer $TOKEN"

# TC-11: eyeball the audit trail for each denial above
curl -s http://localhost:8000/audit | jq '.[] | {identity, action, allowed}'

# TC-12: unknown identity
curl -s -i -X POST "http://localhost:8000/auth/session?identity=not-a-real-role"   # 404

# TC-13: missing Authorization header
curl -s -i http://localhost:8000/alerts/42                                          # 401/422

# TC-14: wrong auth scheme
curl -s -i http://localhost:8000/alerts/42 -H "Authorization: NotBearer abc123"     # 401

# TC-15: tampered token (flip last char of a valid one)
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/session?identity=triage-agent-readonly" | jq -r .access_token)
TAMPERED="${TOKEN%?}$([ "${TOKEN: -1}" = "a" ] && echo b || echo a)"
curl -s -i http://localhost:8000/alerts/42 -H "Authorization: Bearer $TAMPERED"     # 401

# TC-16: expired token (default TTL is 5 min — this one needs a real wait)
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/session?identity=triage-agent-readonly" | jq -r .access_token)
sleep 310
curl -s -i http://localhost:8000/alerts/42 -H "Authorization: Bearer $TOKEN"        # 401

# TC-17: mint token, hand-edit policy/roles.yaml (add trigger_runbook to readonly) WITHOUT restarting uvicorn, retry
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/session?identity=triage-agent-readonly" | jq -r .access_token)
curl -s -i -X POST http://localhost:8000/runbooks/restart-service/trigger -H "Authorization: Bearer $TOKEN"  # still 403 expected

# TC-18: reuse one token across two different permitted actions
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/session?identity=triage-agent-remediator" | jq -r .access_token)
curl -s -i -X POST http://localhost:8000/runbooks/restart-service/trigger -H "Authorization: Bearer $TOKEN"
curl -s -i -X POST "http://localhost:8000/pagerduty/escalate?incident_id=INC-1" -H "Authorization: Bearer $TOKEN"

# TC-19: roles listing
curl -s http://localhost:8000/policy/roles | jq

# TC-20–21: audit pagination
curl -s http://localhost:8000/audit | jq 'length'
curl -s "http://localhost:8000/audit?limit=1" | jq

# TC-22: overflow the 500-record deque
TOKEN=$(curl -s -X POST "http://localhost:8000/auth/session?identity=triage-agent-readonly" | jq -r .access_token)
for i in $(seq 1 510); do curl -s -o /dev/null http://localhost:8000/alerts/$i -H "Authorization: Bearer $TOKEN"; done
curl -s "http://localhost:8000/audit?limit=500" | jq 'length'   # expect 500

# TC-23: not curl-testable — curl ignores CORS. Verify via browser devtools console instead.
```

TC-16 requires an actual 5+ minute wait for the default TTL to lapse (check
`app/tokens.py` for a TTL override if you want a faster loop). TC-22 fires 510
sequential requests and will take a bit to run.
