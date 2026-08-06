"""Policy store: identity -> allowed actions, loaded from YAML."""

from pathlib import Path
from typing import Optional

import yaml

from app.audit import log_permission_check

DEFAULT_POLICY_PATH = Path(__file__).resolve().parent.parent / "policy" / "roles.yaml"


class PolicyStore:
    def __init__(self, policy_path: Path = DEFAULT_POLICY_PATH):
        with open(policy_path) as f:
            data = yaml.safe_load(f)
        self.roles: dict[str, set[str]] = {
            role: set(config.get("permissions", []))
            for role, config in data.get("roles", {}).items()
        }

    def is_allowed(self, identity: str, action: str) -> bool:
        return action in self.roles.get(identity, set())

    def check(self, identity: str, action: str, resource: Optional[str] = None) -> bool:
        allowed = self.is_allowed(identity, action)
        log_permission_check(identity, action, resource, allowed)
        return allowed


policy_store = PolicyStore()
