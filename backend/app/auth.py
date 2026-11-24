from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock
import uuid

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import AuditLog, Company, User, utc_now_iso
from app.schemas import UserProfileSchema

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(plain_password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        return False


def create_access_token(user: User) -> tuple[str, int]:
    now = datetime.now(timezone.utc)
    expires_seconds = settings.jwt_expire_hours * 3600
    payload = {
        "sub": user.id,
        "company_id": user.company_id,
        "email": user.email,
        "role": user.role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_seconds)).timestamp()),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    return token, expires_seconds


class LoginRateLimiter:
    """Thread-safe in-memory sliding-window rate limiter for auth endpoints."""

    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = datetime.now(timezone.utc).timestamp()
        cutoff = now - self.window_seconds
        with self._lock:
            q = self._hits[key]
            while q and q[0] < cutoff:
                q.popleft()
            if len(q) >= self.max_attempts:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many login attempts. Please wait a minute and try again.",
                )
            q.append(now)


login_rate_limiter = LoginRateLimiter(
    max_attempts=settings.login_rate_limit_max,
    window_seconds=settings.login_rate_limit_window_seconds,
)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def write_audit_log(
    db: Session,
    *,
    company_id: str,
    user_id: str | None,
    action: str,
    target_type: str,
    target_id: str,
    detail: str,
    ip_address: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        id=f"AUD-{uuid.uuid4().hex[:12].upper()}",
        company_id=company_id,
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        detail=detail,
        ip_address=ip_address,
        created_at=utc_now_iso(),
    )
    db.add(entry)
    return entry


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials missing or invalid.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    company_id = payload.get("company_id")
    if not isinstance(user_id, str) or not isinstance(company_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication token.",
        )

    user = db.scalar(
        select(User).where(User.id == user_id, User.company_id == company_id)
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User session no longer active.",
        )
    return user


def serialize_user_profile(db: Session, user: User) -> UserProfileSchema:
    company = db.scalar(select(Company).where(Company.id == user.company_id))
    return UserProfileSchema(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        companyId=user.company_id,
        companyName=company.name if company else "Demo Fasteners Pvt Ltd",
        isDemo=user.is_demo,
    )

