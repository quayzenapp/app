from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException

from app.config import settings


@dataclass(frozen=True)
class Caller:
    user_id: str
    org_id: str
    ai_admin: bool
    platform: bool


def caller(authorization: str = Header(default="")) -> Caller:
    """Identity comes only from the JWT signed by the Next.js app. Request bodies never choose the tenant."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    try:
        c = jwt.decode(authorization[7:], settings.ai_jwt_secret, algorithms=["HS256"], audience="quayzen-ai", options={"require": ["exp", "sub", "org", "aud"]})
    except jwt.PyJWTError as e:
        raise HTTPException(401, "Invalid token") from e
    return Caller(user_id=c["sub"], org_id=c["org"], ai_admin=bool(c.get("ai_admin")), platform=bool(c.get("platform")))


def admin(c: Caller = Depends(caller)) -> Caller:
    if not (c.ai_admin or c.platform):
        raise HTTPException(403, "Administrators only")
    return c


def platform(c: Caller = Depends(caller)) -> Caller:
    if not c.platform:
        raise HTTPException(403, "Platform administrators only")
    return c
