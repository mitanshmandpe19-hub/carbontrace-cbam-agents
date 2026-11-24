import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    get_client_ip,
    get_current_user,
    login_rate_limiter,
    serialize_user_profile,
    verify_password,
    write_audit_log,
)
from app.db import get_db
from app.models import Company, User
from app.schemas import (
    LoginRequest,
    MagicLinkRequest,
    MagicLinkResponse,
    TokenResponseSchema,
    UserProfileSchema,
)
from app.services.seed import seed_database_if_empty

logger = logging.getLogger("carbontrace.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponseSchema)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    login_rate_limiter.check(f"login:{client_ip}")

    email_norm = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email_norm))
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token, expires_in = create_access_token(user)
    write_audit_log(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="login",
        target_type="user",
        target_id=user.id,
        detail=f"User {user.email} logged in via email/password.",
        ip_address=client_ip,
    )
    db.commit()

    return TokenResponseSchema(
        accessToken=token,
        expiresInSeconds=expires_in,
        user=serialize_user_profile(db, user),
    )


@router.post("/demo", response_model=TokenResponseSchema)
def demo_login(request: Request, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    demo_user = db.scalar(select(User).where(User.is_demo.is_(True)))
    if demo_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo user is not seeded.",
        )

    token, expires_in = create_access_token(demo_user)
    write_audit_log(
        db,
        company_id=demo_user.company_id,
        user_id=demo_user.id,
        action="demo_login",
        target_type="user",
        target_id=demo_user.id,
        detail="One-click demo session started for Demo Fasteners Pvt Ltd.",
        ip_address=client_ip,
    )
    db.commit()

    return TokenResponseSchema(
        accessToken=token,
        expiresInSeconds=expires_in,
        user=serialize_user_profile(db, demo_user),
    )


@router.post("/magic-link", response_model=MagicLinkResponse)
def request_magic_link(
    payload: MagicLinkRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    client_ip = get_client_ip(request)
    login_rate_limiter.check(f"magic:{client_ip}")

    email_norm = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email_norm))
    fallback_company = db.scalar(select(Company))

    simulated_token = secrets.token_urlsafe(24)
    simulated_url = f"http://localhost:3000/login?magic={simulated_token}"
    # Simulated delivery: log link to server console without leaking account existence in response.
    print(f"[MAGIC LINK - SIMULATED] Email={email_norm} Link={simulated_url}")
    logger.info("Simulated magic login link requested for %s: %s", email_norm, simulated_url)

    company_id = user.company_id if user else (fallback_company.id if fallback_company else "COMP-DEMO-01")
    write_audit_log(
        db,
        company_id=company_id,
        user_id=user.id if user else None,
        action="magic_link_requested",
        target_type="auth",
        target_id=email_norm,
        detail="Simulated passwordless login link logged to console.",
        ip_address=client_ip,
    )
    db.commit()

    return MagicLinkResponse(
        message="If an account matches this email, a login link has been sent."
    )


@router.get("/me", response_model=UserProfileSchema)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return serialize_user_profile(db, current_user)


@router.post("/demo/reset")
def reset_demo_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = db.scalar(select(Company).where(Company.id == current_user.company_id))
    if company is None or not company.is_sample:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo reset is only allowed for the seeded sample company.",
        )

    seed_database_if_empty(db, force_reset_demo=True)
    write_audit_log(
        db,
        company_id=current_user.company_id,
        user_id=current_user.id,
        action="demo_reset",
        target_type="company",
        target_id=current_user.company_id,
        detail="Reset sample factory data back to initial Q3 2026 prototype state.",
        ip_address=get_client_ip(request),
    )
    db.commit()
    return {"status": "reset", "companyId": current_user.company_id}

