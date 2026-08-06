"""Structured JSON audit trail for permission checks."""

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Optional

audit_logger = logging.getLogger("audit")
audit_logger.setLevel(logging.INFO)
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(logging.Formatter("%(message)s"))
audit_logger.addHandler(_handler)
audit_logger.propagate = False


def log_permission_check(identity: str, action: str, resource: Optional[str], allowed: bool) -> None:
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "identity": identity,
        "action": action,
        "resource": resource,
        "allowed": allowed,
    }
    audit_logger.info(json.dumps(record))
