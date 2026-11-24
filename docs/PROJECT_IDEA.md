# CarbonTrace: Project Idea Brief

Team PEACEBREAKERS (Mitansh Mandpe) | RunUp Coders Hackathon 2026 | Round 2: working prototype.
CarbonTrace is the working name and can change.

## 1. One-line pitch
A team of AI agents that turns a small Indian exporter's messy bills and invoices into an audit-ready EU CBAM carbon report, where every number links to the source document it came from.

## 2. The problem
- The EU's CBAM (Carbon Border Adjustment Mechanism) is a carbon tariff on imports of iron and steel, aluminium, cement, fertilisers, electricity and hydrogen. Its definitive phase started on 1 January 2026: EU importers must pay for the emissions embedded in what they import.
- To pay less, the exporter must supply real, verified emissions data. Without it the EU applies default values (one industry source says these run 30-80% higher).
- Indian MSME exporters have never tracked this data. It sits in electricity bills, fuel invoices, raw-material invoices, production logs and supplier emails. They have no carbon team and usually no ERP. Consultants are slow and expensive. One missing supplier reply can cost them an EU customer.
- The hard part is not the maths. It is collecting messy data, chasing suppliers and proving every number.

## 3. The solution
Four agents work around one central **Evidence Ledger** (a table of sourced facts):
1. **Collector** reads the exporter's files and saves each fact with its source page and exact quote.
2. **Outreach** asks suppliers for missing data (email or WhatsApp, English, Hindi or Marathi) and follows up until they reply.
3. **Calculator** computes embedded emissions with plain Python and a sourced emission-factor table. The AI never does the arithmetic.
4. **Verifier** recalculates every number, checks for errors and rejects anything without evidence.

The exporter approves every outgoing supplier message and the final report. The report is exported as PDF and Excel and saved as a dated snapshot, which powers history, trends and supplier profiles.

## 4. Users
- Primary: owners and export managers of Indian MSMEs exporting CBAM goods to the EU (start: steel products such as fasteners).
- Secondary: EU buyers who need supplier data, export consultants and CAs, verifiers, export councils.

## 5. Non-negotiable principles
1. No number appears anywhere without a ledger record pointing to a source document.
2. Calculations are plain code using a fixed factor table. The AI reads and writes, it never calculates.
3. A human approves outgoing messages and the final report.
4. Sample data is always clearly labelled as sample data (banner, labels). Emission factors in the demo are illustrative placeholders, not official values.
5. The Verifier can block the report.

## 6. Features in scope for the prototype
- Sample-files panel (preview, Use this, Use all) plus Upload your own files.
- Pipeline run: collect, find gaps, outreach, calculate, verify, approve, export.
- Evidence Ledger table with a source viewer (click a value, see the document page with the quote highlighted).
- Supplier outreach inbox with approval and a simulated WhatsApp or email thread and reply.
- Verifier results with planted errors it must catch.
- Report with every number clickable, approval, and PDF and Excel export.
- History and trends (emissions per tonne across periods, what changed).
- Supplier profiles and scorecards (what, how much, emissions per tonne, reply speed, data quality).
- Money-saved view: actual emissions vs EU default values.

Simulated in the prototype: WhatsApp and email sending, the EU registry format, multi-company login.

## 7. Demo scenario (all fictional, all labelled sample data)
- **Company:** Demo Fasteners Pvt Ltd (fictional). Product: steel fasteners (bolts and nuts) exported to a German buyer.
- **Periods:** Q1 and Q2 2026 are already approved snapshots (for the trend). Q3 2026 is the active run.
- **Sample files:** three monthly electricity bills (PDF); two diesel or furnace-fuel invoices (one is uploaded twice); raw-material invoices from "Sample Steel Wire Co." and "Sample Alloy Traders"; a production log (Excel); a shipment list with product codes and tonnes (Excel); a simulated supplier reply.
- **Gap:** emissions data for the wire rod from Sample Steel Wire Co. is missing, so Outreach asks them. The reply arrives and the ledger updates.
- **Planted errors the Verifier must catch:**
  1. An electricity value in MWh in the production log vs kWh on the bill (unit mismatch).
  2. The same fuel invoice uploaded twice (duplicate).
  3. A supplier reply says 40 tonnes while the invoice says 45 (conflict).
  4. A hand-typed emission factor with no source (rejected: no evidence).

## 8. What makes it different (honest)
Existing tools (for example Digicust, Assent, carbmee, The Sustainability Cloud, Cleancarbon.ai) already cover data collection, calculation and reporting, and some automate supplier requests or serve Indian exporters. Our edge is click-to-source proof on every number, a separate adversarial Verifier agent, supplier chasing in local languages, MSME-friendly design with no ERP, and history, supplier scorecards and a money-saved view in one flow. We do not claim to be first.

## 9. Glossary
- **CBAM:** the EU's carbon tariff on certain imports.
- **Embedded emissions:** CO2 released making a product, counted per tonne of product (tCO2e).
- **Precursor:** an input material that already carries emissions (for example steel used for fasteners).
- **Default value:** the EU's fallback number used when real data is missing.
- **Emission factor:** emissions per unit of activity, for example per kWh of electricity.
- **Evidence Ledger:** our table of sourced facts that every number is built from.
- **MSME:** micro, small and medium enterprise.

