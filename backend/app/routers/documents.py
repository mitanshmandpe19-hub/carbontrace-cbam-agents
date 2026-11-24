import hashlib
from pathlib import Path
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_client_ip, get_current_user, write_audit_log
from app.config import settings
from app.db import get_db
from app.models import Document, LedgerRecord, PipelineRun, User, utc_now_iso
from app.routers.runs import _authenticate_sse_request
from app.routers.serializers import serialize_document
from app.schemas import DocumentFileSchema, UploadDocumentJsonPayload
from app.services.calculator import recompute_run_calculations
from app.services.collector import collect_document, extract_pages_text
from app.services.verifier import verify_run

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".csv", ".png", ".jpg", ".jpeg"}

router = APIRouter(prefix="/api/documents", tags=["documents"])


class ToggleDocumentPayload(BaseModel):
    selectedForRun: bool


def sanitize_filename(raw_name: str) -> tuple[str, str]:
    base = Path(raw_name.replace("\x00", "")).name.strip()
    if not base:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename.",
        )
    safe = re.sub(r"[^A-Za-z0-9._ \-()]", "_", base)
    ext = Path(safe).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Allowed extensions: pdf, xlsx, csv, png, jpg.",
        )
    return safe[:200], ext


def _format_label_from_ext(ext: str) -> str:
    if ext in (".xlsx", ".csv"):
        return "Excel"
    if ext in (".png", ".jpg", ".jpeg"):
        return "Note"
    return "PDF"


def _build_real_preview_pages(
    *,
    safe_name: str,
    period: str,
    summary: str,
    quote: str,
    rec_id: str,
    pages_text: dict[int, str],
) -> list[dict]:
    if not pages_text:
        return [
            {
                "page": 1,
                "title": f"{safe_name} (Uploaded Document)",
                "subtitle": f"Stored safely | Period: {period}",
                "lines": [
                    {"lineNumber": 1, "text": f"Summary: {summary}"},
                    {"lineNumber": 2, "text": quote, "highlightRecordId": rec_id},
                ],
            }
        ]

    built_pages: list[dict] = []
    q_norm = " ".join(quote.lower().split())
    for pg_num, pg_text in sorted(pages_text.items()):
        raw_lines = [ln.strip() for ln in pg_text.splitlines() if ln.strip()]
        line_objs: list[dict] = []
        matched_any = False
        for i, line_txt in enumerate(raw_lines[:35], start=1):
            ln_norm = " ".join(line_txt.lower().split())
            is_hit = bool(q_norm and (q_norm in ln_norm or ln_norm in q_norm))
            if is_hit:
                matched_any = True
            obj: dict = {"lineNumber": i, "text": line_txt}
            if is_hit:
                obj["highlightRecordId"] = rec_id
            line_objs.append(obj)
        if not line_objs:
            line_objs = [{"lineNumber": 1, "text": quote, "highlightRecordId": rec_id}]
        elif pg_num == 1 and not matched_any:
            line_objs.append(
                {
                    "lineNumber": len(line_objs) + 1,
                    "text": quote,
                    "highlightRecordId": rec_id,
                }
            )
        built_pages.append(
            {
                "page": pg_num,
                "title": f"{safe_name} — Page {pg_num}",
                "subtitle": f"Stored document text | Period: {period}",
                "lines": line_objs,
            }
        )
    return built_pages


@router.get("", response_model=list[DocumentFileSchema])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = list(
        db.scalars(
            select(Document)
            .where(Document.company_id == current_user.company_id)
            .order_by(Document.uploaded_at.desc(), Document.id)
        )
    )
    return [serialize_document(d) for d in docs]


@router.post("/select-all", response_model=list[DocumentFileSchema])
def select_all_sample_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    docs = list(db.scalars(select(Document).where(Document.company_id == cid).order_by(Document.id)))
    for d in docs:
        d.selected_for_run = True
    db.flush()
    recompute_run_calculations(db, cid, "RUN-2026-Q3")
    verify_run(db, cid, "RUN-2026-Q3")
    db.commit()
    return [serialize_document(d) for d in docs]


@router.patch("/{document_id}", response_model=list[DocumentFileSchema])
def toggle_document_selection(
    document_id: str,
    payload: ToggleDocumentPayload,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cid = current_user.company_id
    doc = db.scalar(
        select(Document).where(Document.company_id == cid, Document.id == document_id)
    )
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    doc.selected_for_run = payload.selectedForRun
    db.flush()
    recompute_run_calculations(db, cid, "RUN-2026-Q3")
    verify_run(db, cid, "RUN-2026-Q3")
    db.commit()
    docs = list(
        db.scalars(
            select(Document)
            .where(Document.company_id == cid)
            .order_by(Document.uploaded_at.desc(), Document.id)
        )
    )
    return [serialize_document(d) for d in docs]


@router.post("", response_model=DocumentFileSchema, status_code=status.HTTP_201_CREATED)
async def upload_document(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content_type = request.headers.get("content-type", "").lower()
    cid = current_user.company_id
    doc_id = f"D-U{uuid.uuid4().hex[:6].upper()}"
    rec_id = f"R-AI-{doc_id}-1"
    now_iso = utc_now_iso()

    stored_filename: str | None = None
    file_hash: str | None = None
    file_size = 0
    mime_type = "application/json"
    pages_text: dict[int, str] = {}

    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded = form.get("file")
        if uploaded is None or not hasattr(uploaded, "read"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing file field in multipart upload.",
            )
        raw_filename = getattr(uploaded, "filename", "") or "upload.pdf"
        safe_name, ext = sanitize_filename(raw_filename)

        raw_bytes = await uploaded.read()
        file_size = len(raw_bytes)
        if file_size > settings.max_upload_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds {settings.max_upload_bytes // (1024 * 1024)} MB limit.",
            )
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        file_hash = hashlib.sha256(raw_bytes).hexdigest()
        stored_filename = f"{uuid.uuid4().hex}{ext}"
        dest_path = settings.resolved_upload_dir / stored_filename
        dest_path.write_bytes(raw_bytes)

        doc_type = str(form.get("docType") or "electricity_bill")
        period = str(form.get("period") or "2026-Q3")
        summary = str(
            form.get("summary")
            or f"Uploaded file ({max(1, round(file_size / 1024))} KB) stored securely."
        )
        quote_text = str(form.get("quoteText") or "").strip()
        format_label = _format_label_from_ext(ext)
        mime_type = getattr(uploaded, "content_type", None) or "application/octet-stream"
        pages_text = extract_pages_text(dest_path, ext=ext)
    else:
        body = await request.json()
        payload = UploadDocumentJsonPayload.model_validate(body)
        safe_name, ext = sanitize_filename(payload.fileName)
        doc_type = payload.docType
        period = payload.period
        summary = payload.summary
        quote_text = (payload.quoteText or "").strip()
        format_label = payload.formatLabel
        file_hash = hashlib.sha256(f"{safe_name}:{quote_text}:{period}".encode("utf-8")).hexdigest()

    duplicate_doc = None
    if file_hash:
        duplicate_doc = db.scalar(
            select(Document).where(
                Document.company_id == cid,
                Document.file_hash == file_hash,
            )
        )

    quote = quote_text or f"Uploaded file {safe_name} staged for Collector extraction ({period})."
    preview_pages = _build_real_preview_pages(
        safe_name=safe_name,
        period=period,
        summary=summary,
        quote=quote,
        rec_id=rec_id,
        pages_text=pages_text,
    )

    doc = Document(
        id=doc_id,
        company_id=cid,
        file_name=safe_name,
        stored_filename=stored_filename,
        mime_type=mime_type,
        file_hash=file_hash,
        file_size_bytes=file_size,
        doc_type=doc_type,
        format_label=format_label,
        period=period,
        summary=summary,
        uploaded_at=now_iso,
        is_sample=False,
        selected_for_run=True,
        duplicate_of_id=duplicate_doc.id if duplicate_doc else None,
        preview_pages_json=preview_pages,
    )
    db.add(doc)
    db.flush()

    if stored_filename is not None:
        recs = collect_document(db, doc=doc, run_id="RUN-2026-Q3", user_id=current_user.id)
        if recs:
            # Refresh preview highlight against actual extracted quote
            first = recs[0]
            doc.preview_pages_json = _build_real_preview_pages(
                safe_name=safe_name,
                period=period,
                summary=summary,
                quote=first.quote,
                rec_id=first.id,
                pages_text=pages_text,
            )
    else:
        db.add(
            LedgerRecord(
                id=rec_id,
                company_id=cid,
                run_id="RUN-2026-Q3",
                document_id=doc_id,
                document_name=safe_name,
                page=1,
                quote=quote,
                field="uploaded_user_evidence",
                value=1.0,
                unit="doc",
                period=period,
                extracted_by="cached sample",
                confidence=0.92,
                status="pending",
                created_at=now_iso,
            )
        )

    run = db.scalar(select(PipelineRun).where(PipelineRun.company_id == cid))
    if run:
        logs = list(run.logs_json or [])
        logs.insert(
            0,
            {
                "id": f"LOG-{uuid.uuid4().hex[:8].upper()}",
                "at": now_iso,
                "actor": "collector",
                "message": f"Uploaded {safe_name} and staged evidence in Proof List.",
                "targetId": doc_id,
            },
        )
        run.logs_json = logs
        run.updated_at = now_iso

    write_audit_log(
        db,
        company_id=cid,
        user_id=current_user.id,
        action="upload_document",
        target_type="document",
        target_id=doc_id,
        detail=f"Uploaded document '{safe_name}' (stored={stored_filename or 'metadata-only'}, bytes={file_size}).",
        ip_address=get_client_ip(request),
    )

    db.flush()
    recompute_run_calculations(db, cid, "RUN-2026-Q3")
    verify_run(db, cid, "RUN-2026-Q3")
    db.commit()
    db.refresh(doc)
    return serialize_document(doc)


@router.get("/{document_id}", response_model=DocumentFileSchema)
def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.scalar(
        select(Document).where(
            Document.company_id == current_user.company_id,
            Document.id == document_id,
        )
    )
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return serialize_document(doc)


@router.get("/{document_id}/preview", response_model=DocumentFileSchema)
def preview_document(
    document_id: str,
    page: int = Query(default=1, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = db.scalar(
        select(Document).where(
            Document.company_id == current_user.company_id,
            Document.id == document_id,
        )
    )
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    # Populate extracted real lines dynamically if stored file exists and preview is missing/minimal
    if doc.stored_filename and not doc.is_sample and not doc.preview_pages_json:
        disk_path = settings.resolved_upload_dir / doc.stored_filename
        if disk_path.exists():
            pages_text = extract_pages_text(disk_path)
            doc.preview_pages_json = _build_real_preview_pages(
                safe_name=doc.file_name,
                period=doc.period,
                summary=doc.summary,
                quote=doc.summary,
                rec_id=f"R-AI-{doc.id}-1",
                pages_text=pages_text,
            )
            db.commit()

    return serialize_document(doc, page=page)


@router.get("/{document_id}/raw")
def download_raw_document(
    document_id: str,
    request: Request,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    user = _authenticate_sse_request(request, token, db)
    doc = db.scalar(
        select(Document).where(
            Document.company_id == user.company_id,
            Document.id == document_id,
        )
    )
    if doc is None or not doc.stored_filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file not found.")

    path = (
        settings.resolved_sample_data_dir / doc.stored_filename
        if doc.is_sample
        else settings.resolved_upload_dir / doc.stored_filename
    )
    if not path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stored file missing on disk.")

    return Response(
        content=path.read_bytes(),
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{doc.file_name}"'},
    )
