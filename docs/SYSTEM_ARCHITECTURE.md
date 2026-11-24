# CarbonTrace: System Architecture

Read PROJECT_IDEA.md first. This file describes how the system is built. The frontend is built first against a mock API with exactly the data shapes below, so the real backend can be plugged in later without changing the UI.

## 1. Overview

```
Exporter (browser)
   |
Frontend: Next.js + TypeScript + Tailwind + 3D (React Three Fiber)
   |  REST/JSON  (mock adapter now, FastAPI later)
Backend: Python + FastAPI
   |-- Orchestrator (runs the pipeline, pauses for human approval, schedules follow-ups)
   |-- Collector agent   --> AI model API (Gemini or Claude): reads documents
   |-- Outreach agent    --> AI model API: drafts and reads messages; email / WhatsApp senders (simulated in demo)
   |-- Calculator        --> plain Python + emission-factor table (NO AI)
   |-- Verifier          --> plain Python checks + AI only for wording explanations
   |
Data: PostgreSQL (ledger, calculations, suppliers, reports, audit log) + private file storage (original documents)
```

## 2. Pipeline states (one run per company, product and period)
`created -> collecting -> gaps_found -> awaiting_message_approval -> waiting_supplier_reply -> calculating -> verifying -> needs_fixes | ready_for_approval -> approved -> exported`

- After every supplier reply or fix, the run returns to the gap check.
- If a supplier does not reply after N tries, the gap is closed with the EU default value and the line is labelled `default`.
- Human approval points: each outgoing message, and the final report.

## 3. Data model (PostgreSQL)
- `companies(id, name, is_sample)`; `users(id, company_id, role)` with roles owner, staff, viewer, verifier.
- `documents(id, company_id, file_name, type, storage_path, uploaded_at, is_sample)`.
- `ledger_records(id, run_id, document_id, page, quote, field, value, unit, period, extracted_by, confidence, status[pending|verified|rejected|superseded], created_at)`.
- `emission_factors(id, name, value, unit, year, source, source_url, is_illustrative)`.
- `sector_configs(id, sector, cn_codes, formula, factor_ids)`.
- `calculations(id, run_id, label, formula_text, input_record_ids[], factor_ids[], result_value, result_unit, basis[actual|default])`.
- `verification_flags(id, run_id, code, severity, target_type, target_id, message, status[open|resolved|accepted])`.
- `suppliers(id, company_id, name, contact, language)`; `supplier_profiles(supplier_id, products, volume_by_period, emissions_per_tonne, avg_reply_hours, data_quality_score, last_verified_at)`.
- `outreach_requests(id, run_id, supplier_id, channel, gap_description, draft_text, status[draft|approved|sent|replied|gave_up], tries, next_followup_at)`; `messages(id, request_id, direction, text, sent_at)`.
- `reports(id, run_id, period, product, emissions_per_tonne, breakdown, basis_summary, status, snapshot_json, approved_at)`.
- `audit_log(id, actor[user|agent name], action, target, detail, at)`.

## 4. Calculation spec (plain Python, per sector config)
```
embedded_emissions_per_tonne = (direct + indirect + precursors) / tonnes_of_product_made
direct     = sum(fuel_quantity * fuel_emission_factor) + process_emissions
indirect   = electricity_kWh * grid_emission_factor
precursors = sum(input_quantity * supplier_verified_factor_or_EU_default)
per_shipment = tonnes_shipped * embedded_emissions_per_tonne
money_saved_view = (EU_default_per_tonne - actual_per_tonne) * tonnes * carbon_price   // carbon_price is a user setting
```
- Every result stores `formula_text` and the ids of the ledger records and factors it used.
- Demo factors are illustrative placeholders and must show `Sample factor (illustrative)` as the source. Real values must come from official sources (EU CBAM defaults, India's CEA grid factor, IPCC fuel factors) and each sector config must be checked against the EU methodology before real use.

## 5. Verifier checks (error codes)
`NO_EVIDENCE`, `RECALC_MISMATCH`, `UNIT_MISMATCH`, `DUPLICATE_DOCUMENT`, `OUT_OF_RANGE`, `CROSS_DOC_CONFLICT`, `PERIOD_MISMATCH`, `FACTOR_NO_SOURCE`, `SUPPLIER_CONFLICT`. Severity: block (stops the report), warn, info.

## 6. API contract (REST, JSON)
```
GET  /api/dashboard?period=2026-Q3
GET  /api/documents            POST /api/documents (upload)       GET /api/documents/:id/preview?page=1
POST /api/runs  {period, product}                                 GET /api/runs/:id
GET  /api/ledger?runId=        GET  /api/ledger/:recordId
GET  /api/gaps?runId=
GET  /api/outreach?runId=      POST /api/outreach/:id/approve     POST /api/outreach/:id/simulate-reply   (demo only)
GET  /api/calculations?runId=
GET  /api/factors
GET  /api/verification?runId=  POST /api/verification/:flagId/resolve
POST /api/reports/:runId/approve   GET /api/reports   GET /api/reports/:id/export?format=pdf|xlsx
GET  /api/history?product=steel-fasteners
GET  /api/suppliers            GET /api/suppliers/:id
```
Example shapes:
```json
// ledger record
{"id":"R-12","documentId":"D-03","documentName":"Electricity bill Aug 2026.pdf","page":2,
 "quote":"Units consumed: 48,200 kWh","field":"electricity_used","value":48200,"unit":"kWh",
 "period":"2026-08","extractedBy":"collector","confidence":0.97,"status":"verified"}

// calculation line
{"id":"C-4","label":"Indirect emissions (electricity)","formulaText":"electricity_kWh(R-12,R-13,R-14) x grid_factor(F-3)",
 "inputRecordIds":["R-12","R-13","R-14"],"factorIds":["F-3"],"result":112.4,"unit":"tCO2e","basis":"actual"}

// verification flag
{"id":"V-2","code":"UNIT_MISMATCH","severity":"block","targetType":"ledger_record","targetId":"R-31",
 "message":"Production log lists 120 MWh but the bill shows 120,000 kWh. Confirm the unit.","status":"open"}

// outreach request
{"id":"O-1","supplier":"Sample Steel Wire Co.","channel":"whatsapp","gap":"Emissions per tonne of wire rod",
 "draft":"Namaste, ...","status":"draft","tries":0,"nextFollowupAt":null,
 "thread":[{"direction":"out","text":"...","at":"..."}]}

// report snapshot (history point)
{"id":"RP-2026-Q2","period":"2026-Q2","product":"Steel Fasteners (CN 7318 15)","emissionsPerTonne":2.61,"unit":"tCO2e/t",
 "breakdown":{"direct":0.89,"indirect":0.68,"precursors":1.04},"basisSummary":{"actual":0.78,"default":0.22},
 "totalProductionTonnes":48,"exportedTonnes":44,"euDefaultPerTonne":3.45,"status":"approved","approvedAt":"..."}
```

### Frontend Type Extensions (`src/types/carbon.ts`)
- Added `DocumentFile` (with `previewPages` for the click-to-source viewer), `GapItem`, `ActivityLogItem`, `PipelineRun`, `DashboardSummary`, and `HistoryResponse`.
- Extended `CalculationLine` with `category` (`direct | indirect | precursors | output | intensity`), `VerificationFlag` with `plainExplanation` and `suggestedFix`, and `OutreachRequest` with `language` (`English | Hindi | Marathi`) and `maxTries`.

## 7. Frontend architecture
- Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, React Three Fiber and drei (3D), Recharts, Lucide icons.
- Data access only through `src/lib/api/` (an interface plus `mockApi.ts` that returns data from `src/mock/*.json` with small artificial delays). A flag `NEXT_PUBLIC_USE_MOCK=true` selects the mock. Later, `realApi.ts` calls `NEXT_PUBLIC_API_BASE_URL` (FastAPI) with the same types.
- Types in `src/types/` mirror section 6. No component reads mock JSON directly.
- Run simulation: a small state machine in the mock layer walks through the pipeline states in section 2 with timed events, so the UI can show live progress.
- Routes: `/` landing (3D), `/app` dashboard, `/app/upload`, `/app/run` (agent workspace, 3D), `/app/ledger`, `/app/outreach`, `/app/verification`, `/app/report`, `/app/history`, `/app/suppliers`.
- A persistent "Demo mode: sample data" banner on every `/app` route. Every figure can open the source drawer (document preview with highlighted quote).
- 3D is lazy-loaded, capped in resolution (`dpr={[1, 2]}`), paused off-screen via `IntersectionObserver`, disabled under `prefers-reduced-motion` or on weak devices (`use3DCapability`), paired with accessible Pause/2D toggle controls, and always has a 2D fallback (`Fallback2DHub`).
- Mock mutations persist in browser `localStorage` (`carbontrace-demo-state-v1`) with a **Reset demo** trigger so state carries cleanly across routes during demos.

## 8. Security (design intent; simulated in the prototype)
HTTPS and encryption at rest; one private workspace per company (row-level security); role-based login; private file storage opened only through short-lived signed links; secrets only in server environment variables; send the AI only the text it needs; approval before any outgoing message or report; full audit log; delete-my-data option.

## 9. Deployment
Frontend on Vercel (works standalone with the mock API, so judges can open the link with no signup). Backend later on Render, Railway or Cloud Run with PostgreSQL (Supabase) and private storage.

## 10. Build phases
1. Frontend with mock data (this phase). 2. FastAPI backend with real ledger, calculator and verifier. 3. AI document reading and supplier messaging. 4. Replace the mock adapter with the real API, deploy, record the demo video, update the presentation.
