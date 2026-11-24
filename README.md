# CarbonTrace (Frontend Prototype)

**Team PEACEBREAKERS (Mitansh Mandpe) | RunUp Coders Hackathon 2026 (Round 2)**

CarbonTrace is an agent-assisted EU CBAM reporting prototype built for Indian MSME exporters (starting with steel fasteners). Four specialized agents collaborate around a central **Evidence Ledger** so every reported emission number links directly to the source invoice, utility bill, production log, or supplier reply it came from.

> **Demo Mode Notice**: All companies, shipments, bills, supplier replies, and emission factors in this repository are **fictional sample data** (`Demo Fasteners Pvt Ltd`, Q1–Q3 2026) using **`Sample factor (illustrative)`** placeholders. They must never be treated as official EU CBAM or CEA/IPCC regulatory factors.

---

## Key Principles Demonstrated

1. **No number without a source record**: Clicking any figure in the Dashboard, Evidence Ledger, or CBAM Report opens the **Source Viewer Drawer** showing the exact document page and highlighted quote.
2. **Deterministic calculations in code, never AI**: `(direct + indirect + precursors) / tonnes_of_product_made` and the money-saved comparison run via pure TypeScript functions (`src/lib/calculations.ts`) matching the Python calculator specification in `docs/SYSTEM_ARCHITECTURE.md`.
3. **Human approval gates**: Exporters explicitly approve every outgoing supplier WhatsApp/email draft before sending and approve the final report before PDF/Excel export.
4. **Clear sample-data labelling**: Every `/app` route carries a persistent **"Demo mode: sample data"** banner with a one-click **Reset demo** control, and demo factors are explicitly marked **"Sample factor (illustrative)"**.
5. **Adversarial Verifier gate**: The Verifier catches four planted issues (`UNIT_MISMATCH`, `DUPLICATE_DOCUMENT`, `SUPPLIER_CONFLICT`, `FACTOR_NO_SOURCE`) and blocks report approval until blocking flags are resolved.

---

## How to Run Locally

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (defaults to mock mode if omitted)
cp .env.example .env.local

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser (no login or signup required).

### Useful Scripts

```bash
npm test          # Run Vitest unit tests (calculations, formatters, mockApi workflows)
npm run lint      # Run ESLint across the codebase
npx tsc --noEmit  # Run strict TypeScript type-checking
npm run build     # Build production Next.js bundle (Vercel-ready)
```

---

## Project Structure

```text
docs/
  PROJECT_IDEA.md               # Product pitch, problem, principles & demo scenario
  SYSTEM_ARCHITECTURE.md        # Pipeline states, PostgreSQL schema, API contract & frontend spec
src/
  app/
    page.tsx                    # / Landing page with lazy 3D Evidence Cube hero
    app/
      layout.tsx                # Persistent AppShell, DemoBanner, Skip link & SourceViewerDrawer
      page.tsx                  # /app Dashboard (intensity trend, money saved vs EU default, Next Step)
      upload/page.tsx           # /app/upload Sample-files panel & upload-your-own drop zone
      run/page.tsx              # /app/run Live 3D hub-and-spoke workspace, timeline & activity log
      ledger/page.tsx           # /app/ledger Searchable Evidence Ledger & illustrative factor table
      outreach/page.tsx         # /app/outreach Draft approval, WhatsApp/Email thread & reply simulation
      verification/page.tsx     # /app/verification Verifier flags (4 planted errors) & resolution actions
      report/page.tsx           # /app/report Click-to-source breakdown chart, approval gate & PDF/XLS export
      history/page.tsx          # /app/history Q1–Q3 2026 trajectory chart & what-changed drivers
      suppliers/page.tsx        # /app/suppliers Ranked supplier scorecards
  components/
    layout/AppShell.tsx
    shared/                     # DemoBanner, SourceViewerDrawer, GlossaryTooltip, AgentBadge
    three/                      # Lazy-loaded React Three Fiber scenes + 2D fallback & pause controls
    ui/                         # Accessible button, card, badge, input, progress primitives
  lib/
    api/                        # CarbonTraceApi contract, mockApi.ts & realApi.ts
    calculations.ts             # Deterministic embedded emissions & money-saved formulas
    formatters.ts               # Number, EUR/INR currency, date & agent metadata helpers
    useDemoQuery.ts             # Shared data-fetching hook with demo-reset subscription
    use3DCapability.ts          # Reduced-motion, WebGL & low-spec device detection
  mock/                         # Fictional Demo Fasteners Pvt Ltd JSON fixtures
  types/                        # Shared TypeScript domain interfaces
```

---

## Switching from Mock Data to the Real FastAPI Backend

All UI screens call `api` exported from `src/lib/api/index.ts`. No component imports files from `src/mock/` directly.

1. Keep mock mode enabled (default for standalone Vercel/judge demos):
   ```env
   NEXT_PUBLIC_USE_MOCK=true
   ```
2. Switch to the Python + FastAPI backend when deployed:
   ```env
   NEXT_PUBLIC_USE_MOCK=false
   NEXT_PUBLIC_API_BASE_URL=https://your-carbontrace-api.example.com
   ```
   `src/lib/api/realApi.ts` implements the same `CarbonTraceApi` TypeScript interface against the REST endpoints documented in `docs/SYSTEM_ARCHITECTURE.md`.

---

## Sensible Prototype Notes

- **Browser Session Persistence**: Mock mutations (approving Outreach messages, simulating supplier replies, resolving Verifier flags, uploading sample/user documents, approving reports) persist in `localStorage` (`carbontrace-demo-state-v1`) so state stays consistent across pages. Click **Reset demo** in the top banner anytime to restore the original Q3 scenario.
- **Mock Exports**: Once the Q3 report is approved, **Export PDF** generates a lightweight valid PDF document client-side and **Export Excel** generates an Excel-compatible SpreadsheetML `.xls` workbook, both clearly stamped as sample data.
- **3D Accessibility & Fallback**: The 3D scenes on `/` and `/app/run` are lazy-loaded (`ssr: false`), capped at `dpr={[1, 2]}`, paused when scrolled off-screen, automatically replaced by a 2D hub view under `prefers-reduced-motion` or low-spec devices, and include keyboard-accessible **Pause** and **2D view** buttons.
