"""FastAPI dependency that enforces the policy check before an action executes."""

from fastapi import Header, HTTPException

from app.policy import policy_store


def require_permission(action: str):
    def dependency(x_agent_identity: str = Header(..., alias="X-Agent-Identity")) -> str:
        if not policy_store.check(x_agent_identity, action):
            raise HTTPException(
                status_code=403,
                detail=f"identity '{x_agent_identity}' is not permitted to perform '{action}'",
            )
        return x_agent_identity

    return dependency
