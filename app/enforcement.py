"""FastAPI dependency that authenticates a session token and enforces policy."""

import jwt
from fastapi import Header, HTTPException

from app.policy import policy_store
from app.tokens import decode_token


def _identity_from_bearer_header(authorization: str) -> str:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="expected 'Authorization: Bearer <token>'")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="session token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid session token")
    return payload["sub"]


def require_permission(action: str):
    def dependency(authorization: str = Header(...)) -> str:
        identity = _identity_from_bearer_header(authorization)
        if not policy_store.check(identity, action):
            raise HTTPException(
                status_code=403,
                detail=f"identity '{identity}' is not permitted to perform '{action}'",
            )
        return identity

    return dependency
