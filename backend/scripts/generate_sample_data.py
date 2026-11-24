"""Generate realistic fictional sample bills, invoices, Excel sheets, and cached extraction JSON in backend/sample_data/."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import sys

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BACKEND_ROOT = Path(__file__).resolve().parent.parent
SAMPLE_DIR = BACKEND_ROOT / "sample_data"
CACHE_DIR = SAMPLE_DIR / "cache"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def _write_sample_pdf(path: Path, title: str, subtitle: str, rows: list[tuple[str, str]], note: str) -> None:
    doc = SimpleDocTemplate(str(path), pagesize=A4, title=title)
    styles = getSampleStyleSheet()
    elements = [
        Paragraph(f"<b>{title}</b>", styles["Title"]),
        Spacer(1, 6),
        Paragraph(subtitle, styles["Normal"]),
        Spacer(1, 14),
    ]

    table = Table(rows, colWidths=[190, 300])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F7F4FA")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#2A1740")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D0C7DC")),
                ("PADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    elements.append(table)
    elements.append(Spacer(1, 16))
    elements.append(Paragraph(f"<i>{note}</i>", styles["Normal"]))
    doc.build(elements)


def _write_production_log_xlsx(path: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Q3_Summary"

    header_fill = PatternFill(start_color="F7F4FA", end_color="F7F4FA", fill_type="solid")
    bold = Font(bold=True, color="2A1740")

    ws["A1"] = "Demo Fasteners Pvt Ltd — Q3 2026 Production Log (SAMPLE DATA ONLY)"
    ws["A1"].font = Font(bold=True, size=12, color="2A1740")
    ws["A2"] = "Plant: Pune Midc Bhosari | Period: Jul-Sep 2026"

    ws["A4"] = "Metric"
    ws["B4"] = "Value"
    ws["C4"] = "Unit"
    ws["D4"] = "Notes"
    for cell in ("A4", "B4", "C4", "D4"):
        ws[cell].fill = header_fill
        ws[cell].font = bold

    ws["A8"] = "Product"
    ws["B8"] = "Steel Fasteners (Hex Bolts & Nuts, CN 7318 15)"
    ws["C8"] = "CN 7318 15"
    ws["D8"] = "Finished EU-bound batch"

    ws["A9"] = "Finished Product Output"
    ws["B9"] = 50
    ws["C9"] = "tonnes"
    ws["D9"] = "Verified weighbridge sum for Q3 2026"

    # Planted error #1: MWh instead of kWh (bills are in kWh)
    ws["A14"] = "Total Plant Electricity Logged"
    ws["B14"] = 45
    ws["C14"] = "MWh"
    ws["D14"] = "Planted unit mismatch vs kWh utility bills (14,000 + 16,000 + 15,000 kWh)"

    ws["A15"] = "Scrap & trimmings returned to bin"
    ws["B15"] = 1.0
    ws["C15"] = "tonnes"
    ws["D15"] = "Internal process scrap"

    ws.column_dimensions["A"].width = 34
    ws.column_dimensions["B"].width = 44
    ws.column_dimensions["C"].width = 14
    ws.column_dimensions["D"].width = 56
    wb.save(path)


def _write_shipment_list_xlsx(path: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Exports_DE"

    bold = Font(bold=True, color="2A1740")
    ws["A1"] = "Demo Fasteners Pvt Ltd — EU Shipment List Q3 2026 (SAMPLE DATA ONLY)"
    ws["A1"].font = Font(bold=True, size=12, color="2A1740")
    ws["A2"] = "Buyer: EuroBolt GmbH, Hamburg, Germany"

    headers = ["Container", "CN Code", "Description", "Net Tonnes"]
    ws.append([])
    ws.append(headers)
    for col in range(1, 5):
        ws.cell(row=4, column=col).font = bold

    ws.append(["Container 1", "7318 15 88", "M10 Hex Bolts (Carbon Steel)", 28.0])
    ws.append(["Container 2", "7318 15 90", "M12 Flanged Nuts", 18.0])
    ws.append(["Total EU CBAM Shipped Tonnes", "7318 15", "Q3 2026 Total", 46.0])

    ws.column_dimensions["A"].width = 28
    ws.column_dimensions["B"].width = 16
    ws.column_dimensions["C"].width = 32
    ws.column_dimensions["D"].width = 16
    wb.save(path)


def _write_cache_files(cache_dir: Path) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached_specs: dict[str, list[dict]] = {
        "D-01": [
            {
                "id": "R-01",
                "field": "electricity_used",
                "value": 14000,
                "unit": "kWh",
                "period": "2026-07",
                "page": 1,
                "quote": "Units consumed 14,000 kWh",
                "status": "verified",
            }
        ],
        "D-02": [
            {
                "id": "R-02",
                "field": "electricity_used",
                "value": 16000,
                "unit": "kWh",
                "period": "2026-08",
                "page": 1,
                "quote": "Units consumed 16,000 kWh",
                "status": "verified",
            }
        ],
        "D-03": [
            {
                "id": "R-03",
                "field": "electricity_used",
                "value": 15000,
                "unit": "kWh",
                "period": "2026-09",
                "page": 1,
                "quote": "Units consumed 15,000 kWh",
                "status": "verified",
            }
        ],
        "D-04": [
            {
                "id": "R-04",
                "field": "furnace_oil_used",
                "value": 10000,
                "unit": "L",
                "period": "2026-Q3",
                "page": 1,
                "quote": "Quantity delivered 10,000 Litres",
                "status": "verified",
            }
        ],
        "D-05": [
            {
                "id": "R-05",
                "field": "furnace_oil_used_duplicate",
                "value": 10000,
                "unit": "L",
                "period": "2026-Q3",
                "page": 1,
                "quote": "Quantity delivered 10,000 Litres",
                "status": "pending",
            }
        ],
        "D-06": [
            {
                "id": "R-06",
                "field": "diesel_used",
                "value": 4000,
                "unit": "L",
                "period": "2026-09",
                "page": 1,
                "quote": "Diesel supplied for plant DG set 4,000 Litres",
                "status": "verified",
            }
        ],
        "D-07": [
            {
                "id": "R-07",
                "field": "precursor_wire_rod_tonnes",
                "value": 45,
                "unit": "t",
                "period": "2026-Q3",
                "page": 1,
                "quote": "Net Weight Billed 45.0 tonnes",
                "status": "verified",
            }
        ],
        "D-08": [
            {
                "id": "R-08",
                "field": "precursor_alloy_tonnes",
                "value": 6,
                "unit": "t",
                "period": "2026-Q3",
                "page": 1,
                "quote": "Net Weight Supplied 6.0 tonnes",
                "status": "verified",
            },
            {
                "id": "R-09",
                "field": "precursor_alloy_factor",
                "value": 1.25,
                "unit": "tCO2e/t",
                "period": "2026-Q3",
                "page": 1,
                "quote": "Declared Precursor Emissions 1.25 tCO2e/t (Sample verified certificate)",
                "status": "verified",
            },
        ],
        "D-09": [
            {
                "id": "R-10",
                "field": "product_tonnes_made",
                "value": 50,
                "unit": "t",
                "period": "2026-Q3",
                "page": 1,
                "quote": "Finished Product Output | 50 | tonnes",
                "status": "verified",
            },
            {
                "id": "R-11",
                "field": "electricity_log_check",
                "value": 45,
                "unit": "MWh",
                "period": "2026-Q3",
                "page": 1,
                "quote": "Total Plant Electricity Logged | 45 | MWh",
                "status": "pending",
            },
        ],
        "D-10": [
            {
                "id": "R-12",
                "field": "eu_exported_tonnes",
                "value": 46,
                "unit": "t",
                "period": "2026-Q3",
                "page": 1,
                "quote": "Total EU CBAM Shipped Tonnes | 7318 15 | Q3 2026 Total | 46",
                "status": "verified",
            }
        ],
        "D-11": [
            {
                "id": "R-13",
                "field": "unsourced_manual_factor",
                "value": 0.0021,
                "unit": "tCO2e/kg",
                "period": "2026-Q3",
                "page": 1,
                "quote": "Manual factor entered: 0.0021 tCO2e/kg (no source citation)",
                "status": "rejected",
            }
        ],
        "D-12": [
            {
                "id": "R-15",
                "field": "precursor_wire_rod_tonnes_reply",
                "value": 40,
                "unit": "t",
                "period": "2026-Q3",
                "page": 1,
                "quote": "Batch quantity noted in reply: 40 tonnes supplied in Q3 (Invoice says 45 t).",
                "status": "pending",
            }
        ],
    }

    for doc_id, facts in cached_specs.items():
        (cache_dir / f"{doc_id}.json").write_text(
            json.dumps({"documentId": doc_id, "facts": facts}, indent=2),
            encoding="utf-8",
        )


def generate_all(output_dir: Path | None = None) -> dict[str, dict[str, str]]:
    """Generate all sample files + cache/*.json and return documentId -> metadata dict with sha256 hashes."""
    target_dir = output_dir or SAMPLE_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    _write_cache_files(target_dir / "cache")
    metadata: dict[str, dict[str, str]] = {}

    bills = [
        ("D-01", "Electricity_Bill_Jul_2026.pdf", "July 2026", "128,400 kWh", "142,400 kWh", "14,000 kWh", "INR 1,24,600"),
        ("D-02", "Electricity_Bill_Aug_2026.pdf", "August 2026", "142,400 kWh", "158,400 kWh", "16,000 kWh", "INR 1,41,800"),
        ("D-03", "Electricity_Bill_Sep_2026.pdf", "September 2026", "158,400 kWh", "173,400 kWh", "15,000 kWh", "INR 1,33,200"),
    ]
    for doc_id, fname, month, prev_r, curr_r, units, payable in bills:
        p = target_dir / fname
        _write_sample_pdf(
            p,
            "Maharashtra State Electricity Distribution (Sample Bill)",
            f"Consumer: Demo Fasteners Pvt Ltd | Billing Month: {month} | Sample Document",
            [
                ("Field", "Value"),
                ("Consumer No", "170044912881 (Tariff: HT-Industry)"),
                ("Meter Reading (Prev)", prev_r),
                ("Meter Reading (Curr)", curr_r),
                ("Units consumed", units),
                ("Total Payable", f"{payable} (Sample data only)"),
            ],
            "SAMPLE DOCUMENT — Generated for CarbonTrace prototype demonstration only.",
        )
        metadata[doc_id] = {"stored_filename": fname, "file_hash": sha256_file(p)}

    fo_orig = target_dir / "Furnace_Oil_Invoice_Jul_Aug_2026.pdf"
    _write_sample_pdf(
        fo_orig,
        "Western Industrial Fuels (Sample Invoice)",
        "Invoice #FO-2026-884 | Buyer: Demo Fasteners Pvt Ltd | Sample Document",
        [
            ("Field", "Value"),
            ("Invoice Number", "#FO-2026-884"),
            ("Date", "14 August 2026 | GSTIN: 27AAACS0000A1Z5"),
            ("Item", "Heat-Treatment Furnace Oil (Grade LDO)"),
            ("Quantity delivered", "10,000 Litres"),
            ("Delivery Chalan", "WIF-4410"),
        ],
        "SAMPLE DOCUMENT — Illustrative invoice for prototype verification.",
    )
    metadata["D-04"] = {"stored_filename": fo_orig.name, "file_hash": sha256_file(fo_orig)}

    fo_copy = target_dir / "Furnace_Oil_Invoice_Jul_Aug_2026_copy.pdf"
    shutil.copyfile(fo_orig, fo_copy)
    metadata["D-05"] = {"stored_filename": fo_copy.name, "file_hash": sha256_file(fo_copy)}

    diesel_path = target_dir / "Diesel_Generator_Invoice_Sep_2026.pdf"
    _write_sample_pdf(
        diesel_path,
        "Deccan Petroleum Depot (Sample Invoice)",
        "Invoice #DL-2026-412 | Buyer: Demo Fasteners Pvt Ltd | Sample Document",
        [
            ("Field", "Value"),
            ("Invoice Number", "#DL-2026-412"),
            ("Date", "19 September 2026"),
            ("Product", "High-Speed Industrial Diesel"),
            ("Diesel supplied for plant DG set", "4,000 Litres"),
            ("Total Amount", "INR 3,68,000 (Sample data only)"),
        ],
        "SAMPLE DOCUMENT — Illustrative diesel generator fuel invoice.",
    )
    metadata["D-06"] = {"stored_filename": diesel_path.name, "file_hash": sha256_file(diesel_path)}

    wire_path = target_dir / "Sample_Steel_Wire_Co_Invoice.pdf"
    _write_sample_pdf(
        wire_path,
        "Sample Steel Wire Co. (Tax Invoice - Sample)",
        "Invoice #SWC-9012 | Material: Cold-Heading Steel Wire Rod | Sample Document",
        [
            ("Field", "Value"),
            ("Invoice Number", "#SWC-9012"),
            ("Supplier", "Sample Steel Wire Co., Nashik (Sample)"),
            ("CN / HS Code", "7213 91 | Grade: SAE 1018 Wire Rod"),
            ("Net Weight Billed", "45.0 tonnes"),
            ("Embedded Emissions", "NOT printed on invoice (requires outreach)"),
        ],
        "SAMPLE DOCUMENT — Precursor emissions intensity intentionally absent for Outreach demo.",
    )
    metadata["D-07"] = {"stored_filename": wire_path.name, "file_hash": sha256_file(wire_path)}

    alloy_path = target_dir / "Sample_Alloy_Traders_Invoice.pdf"
    _write_sample_pdf(
        alloy_path,
        "Sample Alloy Traders (Tax Invoice & Mill Sheet - Sample)",
        "Invoice #AT-319 | Material: Alloy & Zinc Wire | Sample Document",
        [
            ("Field", "Value"),
            ("Invoice Number", "#AT-319"),
            ("Supplier", "Sample Alloy Traders, Thane (Sample)"),
            ("Net Weight Supplied", "6.0 tonnes"),
            ("Declared Precursor Emissions", "1.25 tCO2e/t (Sample verified certificate)"),
        ],
        "SAMPLE DOCUMENT — Illustrative supplier precursor sheet.",
    )
    metadata["D-08"] = {"stored_filename": alloy_path.name, "file_hash": sha256_file(alloy_path)}

    prod_path = target_dir / "Production_Log_Q3_2026.xlsx"
    _write_production_log_xlsx(prod_path)
    metadata["D-09"] = {"stored_filename": prod_path.name, "file_hash": sha256_file(prod_path)}

    ship_path = target_dir / "EU_Shipment_List_Q3_2026.xlsx"
    _write_shipment_list_xlsx(ship_path)
    metadata["D-10"] = {"stored_filename": ship_path.name, "file_hash": sha256_file(ship_path)}

    note_path = target_dir / "Floor_Supervisor_Note_Custom_Gas_Factor.txt"
    note_path.write_text(
        "Demo Fasteners Pvt Ltd — Hand-Typed Supervisor Note (Sample)\n"
        "Author: Plant Shift Note (no lab report or factor table attached)\n"
        "Manual factor entered: 0.0021 tCO2e/kg (no source citation)\n",
        encoding="utf-8",
    )
    metadata["D-11"] = {"stored_filename": note_path.name, "file_hash": sha256_file(note_path)}

    reply_path = target_dir / "Sample_Steel_Wire_Co_WhatsApp_Reply.txt"
    reply_path.write_text(
        "WhatsApp Thread Export — Sample Steel Wire Co. (Sample Data Only)\n"
        "From: Rajesh Kulkarni (Sample Steel Wire Co.)\n"
        "Message: Namaste ji, our EAF wire rod intensity is 0.90 tCO2e/t for Q3.\n"
        "Batch quantity noted in reply: 40 tonnes supplied in Q3 (Invoice says 45 t).\n",
        encoding="utf-8",
    )
    metadata["D-12"] = {"stored_filename": reply_path.name, "file_hash": sha256_file(reply_path)}

    return metadata


def main() -> int:
    generated = generate_all()
    print(f"Generated {len(generated)} sample files + cache JSONs in {SAMPLE_DIR}")
    for doc_id, info in sorted(generated.items()):
        print(f"  {doc_id}: {info['stored_filename']} (sha256={info['file_hash'][:12]}...)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
