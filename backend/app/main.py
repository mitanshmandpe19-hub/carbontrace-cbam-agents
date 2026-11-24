from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, SessionLocal, engine
from app.routers import (
    auth_router,
    calculations,
    dashboard,
    documents,
    gaps,
    history,
    ledger,
    outreach,
    reports,
    runs,
    suppliers,
    verification,
)
from app.services.orchestrator import notify_run_update
from app.services.outreach import process_outreach_followup_sweep
from app.services.seed import seed_database_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database_if_empty(db)
    finally:
        db.close()

    scheduler = BackgroundScheduler()
    scheduler.add_job(
        process_outreach_followup_sweep,
        "interval",
        seconds=settings.followup_interval_seconds,
        kwargs={"notify_callback": notify_run_update},
        id="outreach_followup_sweep",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="CarbonTrace Orchestrated AI + Deterministic EU CBAM Backend (Sample Data)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowlist,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Content-Disposition"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "carbontrace-api",
        "geminiModel": settings.gemini_model,
        "geminiConfigured": bool(settings.gemini_api_key.strip()),
    }


app.include_router(auth_router.router)
app.include_router(dashboard.router)
app.include_router(documents.router)
app.include_router(runs.router)
app.include_router(ledger.router)
app.include_router(gaps.router)
app.include_router(outreach.router)
app.include_router(calculations.calculations_router)
app.include_router(calculations.factors_router)
app.include_router(verification.router)
app.include_router(reports.router)
app.include_router(history.router)
app.include_router(suppliers.router)
