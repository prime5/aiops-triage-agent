"""Short-lived, scoped session tokens for agent-to-service calls.

Each triage session mints its own token instead of the agent running with
standing credentials. The token's `scope` claim is a snapshot of the
identity's permissions at mint time, for audit purposes; authorization
decisions still re-check the live policy via the identity (`sub`) claim,
so a policy change takes effect immediately without needing revocation.
"""

import os
import time
from typing import Any, Dict

import jwt

from app.policy import policy_store

SECRET_KEY = os.environ.get("TRIAGE_JWT_SECRET", "dev-secret-change-me-32-bytes-min")
ALGORITHM = "HS256"
DEFAULT_TTL_SECONDS = 300


def mint_token(identity: str, ttl_seconds: int = DEFAULT_TTL_SECONDS) -> str:
    now = int(time.time())
    payload = {
        "sub": identity,
        "scope": sorted(policy_store.roles.get(identity, set())),
        "iat": now,
        "exp": now + ttl_seconds,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
