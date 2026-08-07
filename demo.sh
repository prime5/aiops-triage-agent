#!/usr/bin/env bash
# Narrated, one-command walkthrough of the identity/permissions layer.
# Mints session tokens for two agent identities, shows an allowed action,
# an overreach that gets denied, and the resulting audit trail.
set -euo pipefail
cd "$(dirname "$0")"

PORT=8901
BASE="http://127.0.0.1:${PORT}"
LOG_FILE="$(mktemp)"

NAVY='\033[38;5;24m'; GREEN='\033[38;5;35m'; RED='\033[38;5;160m'
DIM='\033[2m'; BOLD='\033[1m'; RESET='\033[0m'

narrate() { printf "\n${BOLD}${NAVY}▶ %s${RESET}\n" "$1"; }
note()    { printf "${DIM}  %s${RESET}\n" "$1"; }
pause()   { sleep 1.1; }

cleanup() {
  [[ -n "${SERVER_PID:-}" ]] && kill "$SERVER_PID" 2>/dev/null || true
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

if [[ ! -x .venv/bin/uvicorn ]]; then
  echo "Expected a virtualenv at .venv with dependencies installed. Run:"
  echo "  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

narrate "Starting the triage-agent action layer on :${PORT}"
.venv/bin/uvicorn app.main:app --port "$PORT" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 20); do
  curl -s -o /dev/null "${BASE}/docs" && break
  sleep 0.3
done
note "server up (pid $SERVER_PID), audit log streaming to $LOG_FILE"
pause

narrate "Minting a short-lived session token for 'triage-agent-readonly'"
note "in production this would happen once per triage run, not per request"
RO_TOKEN=$(curl -s -X POST "${BASE}/auth/session?identity=triage-agent-readonly" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
echo "  token: ${RO_TOKEN:0:24}...${RO_TOKEN: -8}"
pause

narrate "Read-only agent reads an alert — this is within its permissions"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/alerts/42" \
  -H "Authorization: Bearer ${RO_TOKEN}")
printf "  ${GREEN}%s${RESET} GET /alerts/42\n" "$CODE"
pause

narrate "Same agent now tries to trigger a remediation runbook"
note "this is the overreach: a read-only identity attempting a remediator action"
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE}/runbooks/restart-service/trigger" \
  -H "Authorization: Bearer ${RO_TOKEN}")
CODE=$(tail -n1 <<<"$RESP")
BODY=$(sed '$d' <<<"$RESP")
printf "  ${RED}%s${RESET} POST /runbooks/restart-service/trigger\n" "$CODE"
printf "  ${DIM}%s${RESET}\n" "$BODY"
pause

narrate "Minting a token for 'triage-agent-remediator' and retrying the same action"
REM_TOKEN=$(curl -s -X POST "${BASE}/auth/session?identity=triage-agent-remediator" \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE}/runbooks/restart-service/trigger" \
  -H "Authorization: Bearer ${REM_TOKEN}")
printf "  ${GREEN}%s${RESET} POST /runbooks/restart-service/trigger (correct identity)\n" "$CODE"
pause

narrate "Audit trail — every check above, allowed or denied, logged automatically"
grep '"identity"' "$LOG_FILE" | while read -r line; do
  if grep -q '"allowed": false' <<<"$line"; then
    printf "  ${RED}%s${RESET}\n" "$line"
  else
    printf "  ${GREEN}%s${RESET}\n" "$line"
  fi
done
pause

narrate "Running the pinned-down test suite (same scenarios, automated)"
.venv/bin/python -m pytest tests/ -v --color=yes 2>&1 | tail -n +5

narrate "Done. Server shutting down."
