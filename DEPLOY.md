# CarbonTrace Deployment Guide (Render + Vercel)

This guide covers deploying the **CarbonTrace** EU CBAM agentic platform:
- **Backend:** FastAPI (Python 3.11) on [Render](https://render.com)
- **Frontend:** Next.js (App Router) on [Vercel](https://vercel.com)

Repository: [https://github.com/mitanshmandpe19-hub/carbontrace-cbam-agents](https://github.com/mitanshmandpe19-hub/carbontrace-cbam-agents)

---

## Architecture Overview

```
                      HTTPS / JWT
   [ User Browser ] ---------------> [ Vercel: Next.js Frontend ]
          |                                      |
          |               REST API + SSE         |
          +-------------------------------------> [ Render: FastAPI Backend ]
                                                         |
                                            +------------+------------+
                                            |                         |
                                   [ SQLite / Postgres ]     [ Google Gemini Flash ]
```

---

## Step 1: Deploy Backend on Render

You can deploy using either the **One-Click Blueprint** (`render.yaml`) or **Manual Web Service**.

### Option A: Using Blueprint (Recommended)
1. Sign in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint**.
3. Connect your GitHub repository: `carbontrace-cbam-agents`.
4. Render will detect `render.yaml`. Click **Apply**.
5. When prompted in the dashboard, provide the secret environment variables:
   - `GEMINI_API_KEY`: Your Google Gemini API key from [Google AI Studio](https://aistudio.google.com). *(If left blank, the app runs in deterministic demo mode using cached sample extractions)*.
   - `CORS_ORIGINS`: Set temporarily to `*` or leave default until you obtain your Vercel URL.
6. Click **Deploy**.

---

### Option B: Manual Web Service Setup
1. In the [Render Dashboard](https://dashboard.render.com), click **New +** > **Web Service**.
2. Select your repository `carbontrace-cbam-agents`.
3. Fill in the service configuration:
   - **Name**: `carbontrace-backend`
   - **Region**: Choose the closest region (e.g. Frankfurt, Oregon, Singapore)
   - **Root Directory**: `backend`
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
   - **Plan**: `Free`
4. Under **Environment Variables**, add:
   | Key | Value / Notes |
   |---|---|
   | `PYTHON_VERSION` | `3.11.9` |
   | `DATABASE_URL` | `sqlite:///./carbontrace.db` (or Render PostgreSQL internal URL) |
   | `JWT_SECRET` | Click **Generate** or enter a 32+ character random string |
   | `GEMINI_API_KEY` | Your key from [aistudio.google.com](https://aistudio.google.com) (or placeholder) |
   | `GEMINI_MODEL` | `gemini-2.5-flash` |
   | `CORS_ORIGINS` | `*` (updated in Step 3 to the exact Vercel URL) |
   | `DEMO_MODE` | `true` |
   | `DEMO_USER_PASSWORD` | `demo-fasteners-2026` |
   | `UPLOAD_DIR` | `./uploads` |
5. Click **Create Web Service**.

> [!NOTE]
> Copy your backend public URL once deployed (e.g. `https://carbontrace-backend.onrender.com`).
> Verify it by visiting `https://carbontrace-backend.onrender.com/health` in your browser. It should return `{"status":"ok", ...}`.

---

## Step 2: Deploy Frontend on Vercel

1. Log in to [Vercel](https://vercel.com) and click **Add New...** > **Project**.
2. Import the `carbontrace-cbam-agents` repository.
3. Configure the project:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
4. Under **Environment Variables**, add the following two variables:
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE_URL` | Your Render backend URL (e.g. `https://carbontrace-backend.onrender.com` - **NO trailing slash**) |
   | `NEXT_PUBLIC_USE_MOCK` | `false` |

> [!IMPORTANT]
> `NEXT_PUBLIC_` variables are public in the client bundle. Never store `GEMINI_API_KEY` or `JWT_SECRET` in Vercel environment variables.

5. Click **Deploy**.
6. When deployment finishes, copy your frontend production URL (e.g. `https://carbontrace-cbam-agents.vercel.app`).

---

## Step 3: Connect Backend & Frontend (CORS Security)

Now that you have your live frontend URL, configure CORS on the backend for optimal security:

1. Return to the [Render Dashboard](https://dashboard.render.com).
2. Select your `carbontrace-backend` service.
3. Navigate to **Environment**.
4. Update `CORS_ORIGINS`:
   ```
   https://carbontrace-cbam-agents.vercel.app,http://localhost:3000
   ```
   *(Or keep `*` if you want all Vercel branch preview URLs to have access)*.
5. Click **Save Changes** (Render will trigger a fast zero-downtime re-deploy).

---

## Step 4: Verification Checklist (5 Quick Checks)

Verify the deployed app end-to-end:

1. **Health Check**: Open `https://<your-render-url>/health`.
   - Returns: `{"status":"ok","service":"carbontrace-api","geminiModel":"gemini-2.5-flash","geminiConfigured":true|false}`.
2. **Demo Login**: Open `https://<your-vercel-url>/login`.
   - Click **"Continue as demo user"**. You are instantly authenticated into the dashboard as Demo Fasteners Pvt Ltd without typing credentials.
3. **Upload / Inspect Evidence**:
   - Go to **Documents**. View the pre-seeded Q3 2026 invoices. Click on any file to inspect the extracted preview.
4. **Agent Orchestration**:
   - Go to **Agent Workspace** or **Calculations**. Click **Run calculations** or view active verifications and supplier outreach items.
5. **Report & Export**:
   - Go to **Reports**. Click **Export PDF** and **Export Excel**. The real downloadable CBAM declaration files should download immediately.

---

## Troubleshooting

### 1. "Waking up the server, this may take 30-50 seconds..."
- **Cause**: Render's Free tier spins instances down to sleep after 15 minutes of inactivity.
- **Handling**: The CarbonTrace frontend automatically intercepts 502/503 errors and network drops, displaying the friendly waking banner and polling `/health` for up to 60 seconds before seamlessly resuming your request.

### 2. CORS Errors (`Cross-Origin Request Blocked`)
- **Cause**: The frontend origin does not match `CORS_ORIGINS` in Render.
- **Fix**: In Render > Environment, set `CORS_ORIGINS` to `*` or add your exact Vercel URL: `https://your-domain.vercel.app`. Make sure there is **no trailing slash**.

### 3. PostgreSQL Database Connection (`psycopg` Error)
- **Cause**: Render PostgreSQL internal URLs begin with `postgres://` or `postgresql://`.
- **Handling**: CarbonTrace automatically converts `postgres://` and `postgresql://` into `postgresql+psycopg://` at runtime. Ensure `DATABASE_URL` is set to your Render Postgres internal database connection string.

### 4. Gemini API Quota or Missing Key
- **Handling**: If `GEMINI_API_KEY` is not provided or runs out of quota, CarbonTrace logs a warning and automatically falls back to cached sample extractions and localized bilingual templates. The demo **never breaks**.
