"""Structured JSON audit trail for permission checks."""

import json
import logging
import sys
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

audit_logger = logging.getLogger("audit")
audit_logger.setLevel(logging.INFO)
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter("%(message)s"))
audit_logger.addHandler(_handler)
audit_logger.propagate = False

# Recent records kept in memory for the dashboard UI. Resets on restart —
# the stdout JSON log above remains the durable trail.
_recent_records: "deque[Dict[str, Any]]" = deque(maxlen=500)


def log_permission_check(identity: str, action: str, resource: Optional[str], allowed: bool) -> None:
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "identity": identity,
        "action": action,
        "resource": resource,
        "allowed": allowed,
    }
    audit_logger.info(json.dumps(record))
    _recent_records.append(record)


def get_recent_audit_records(limit: int = 200) -> List[Dict[str, Any]]:
    records = list(_recent_records)[-limit:]
    records.reverse()  # newest first
    return records
