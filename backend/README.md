# CarbonTrace Backend (Prototype API)

FastAPI + SQLAlchemy 2 + Pydantic v2 backend for CarbonTrace. Stores data in SQLite by default via `DATABASE_URL` (PostgreSQL-ready), runs deterministic Python carbon calculations and Verifier checks, seeds fictional sample data for **Demo Fasteners Pvt Ltd**, and exports real PDF (`reportlab`) and Excel (`openpyxl`) CBAM reports.

> All seeded company data, documents, and emission factors are fictional sample data labelled **"Sample factor (illustrative)"**.

## Setup & Run

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate  |  macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # then set JWT_SECRET_KEY and DEMO_USER_PASSWORD in .env
```

Optional — regenerate realistic sample PDFs and Excel sheets in `backend/sample_data/`:

```bash
python -m scripts.generate_sample_data
```

Start the API server (auto-creates tables and seeds empty databases on startup):

```bash
uvicorn app.main:app --reload
```

API docs open at `http://localhost:8000/docs`. To point the Next.js frontend to this API, set `NEXT_PUBLIC_USE_MOCK=false` and `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` in `.env.local`.

