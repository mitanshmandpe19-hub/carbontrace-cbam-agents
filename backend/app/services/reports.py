"""Real PDF (reportlab) and XLSX (openpyxl) EU CBAM report exporters."""

from __future__ import annotations

from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import CalculationLineModel, EmissionFactor, LedgerRecord, ReportSnapshot
from app.services.calculator import compute_money_saved


def build_report_pdf_bytes(
    *,
    company_name: str,
    report: ReportSnapshot,
    calculations: list[CalculationLineModel],
    ledger: list[LedgerRecord],
    carbon_price_eur: float = 85.0,
) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
        title=f"CarbonTrace CBAM Report {report.period}",
    )
    styles = getSampleStyleSheet()
    heading_style = ParagraphStyle(
        "HeadingCT",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#2A1740"),
        spaceAfter=6,
    )
    small_style = ParagraphStyle(
        "SmallCT",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#2A1740"),
    )

    savings = compute_money_saved(
        report.eu_default_per_tonne,
        report.emissions_per_tonne,
        report.exported_tonnes,
        carbon_price_eur,
    )

    elements = [
        Paragraph("<b>CarbonTrace EU CBAM Report — SAMPLE DATA ONLY</b>", styles["Title"]),
        Spacer(1, 4),
        Paragraph(
            f"Exporter: <b>{company_name}</b> &nbsp;|&nbsp; Period: <b>{report.period}</b> &nbsp;|&nbsp; "
            f"Product: <b>{report.product}</b> &nbsp;|&nbsp; Status: <b>{report.status.upper()}</b>",
            styles["Normal"],
        ),
        Spacer(1, 10),
    ]

    summary_rows = [
        ["Metric", "Value", "Notes"],
        [
            "Embedded Emissions Intensity",
            f"{report.emissions_per_tonne:.2f} {report.unit}",
            f"Actual basis: {round(report.basis_summary_json.get('actual', 0) * 100)}% | Default: {round(report.basis_summary_json.get('default', 0) * 100)}%",
        ],
        [
            "Breakdown (Direct / Indirect / Precursors)",
            f"{report.breakdown_json.get('direct', 0):.2f} / {report.breakdown_json.get('indirect', 0):.2f} / {report.breakdown_json.get('precursors', 0):.2f}",
            "tCO2e per tonne of steel fasteners",
        ],
        [
            "Production vs EU Exported Tonnes",
            f"{report.total_production_tonnes:g} t / {report.exported_tonnes:g} t",
            "Sourced from R-10 Production Log & R-12 Shipment List",
        ],
        [
            f"Illustrative Savings vs EU Default ({report.eu_default_per_tonne:.2f})",
            f"EUR {savings['moneySavedEur']:,.2f}",
            f"Computed at illustrative carbon price EUR {carbon_price_eur:g}/tCO2e",
        ],
    ]
    summary_table = Table(summary_rows, colWidths=[185, 130, 205])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2A1740")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CFC7DC")),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(summary_table)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("Deterministic Calculation Lines", heading_style))
    calc_rows = [["ID", "Calculation Line", "Sources", "Result", "Basis"]]
    for line in calculations:
        calc_rows.append(
            [
                line.id,
                Paragraph(f"{line.label}<br/><font size=8 color='#5B4B6E'>{line.formula_text}</font>", small_style),
                ", ".join(line.input_record_ids_json),
                f"{line.result:.2f} {line.unit}",
                line.basis,
            ]
        )
    calc_table = Table(calc_rows, colWidths=[42, 265, 85, 78, 50])
    calc_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F7F4FA")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#2A1740")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D7CFE3")),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(calc_table)
    elements.append(Spacer(1, 14))

    elements.append(Paragraph("Evidence Ledger — Every Number Linked to Source Document & Page", heading_style))
    ledger_rows = [["ID", "Source Document (Page)", "Value", "Status", "Exact Quote"]]
    for rec in ledger:
        ledger_rows.append(
            [
                rec.id,
                Paragraph(f"{rec.document_name} (p.{rec.page})", small_style),
                f"{rec.value:g} {rec.unit}",
                rec.status,
                Paragraph(rec.quote, small_style),
            ]
        )
    ledger_table = Table(ledger_rows, colWidths=[42, 155, 72, 62, 189])
    ledger_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EEF4FC")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#174E91")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D7CFE3")),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    elements.append(ledger_table)
    elements.append(Spacer(1, 12))
    elements.append(
        Paragraph(
            "<i>Disclaimer: Prototype output using fictional company Demo Fasteners Pvt Ltd and illustrative sample emission factors.</i>",
            small_style,
        )
    )

    doc.build(elements)
    return buffer.getvalue()


def build_report_xlsx_bytes(
    *,
    company_name: str,
    report: ReportSnapshot,
    calculations: list[CalculationLineModel],
    ledger: list[LedgerRecord],
    factors: list[EmissionFactor],
    carbon_price_eur: float = 85.0,
) -> bytes:
    wb = Workbook()

    # Sheet 1: Summary
    ws_sum = wb.active
    ws_sum.title = "CBAM_Summary"
    header_fill = PatternFill(start_color="2A1740", end_color="2A1740", fill_type="solid")
    soft_fill = PatternFill(start_color="F7F4FA", end_color="F7F4FA", fill_type="solid")
    header_font = Font(bold=True, color="FFFFFF")
    bold_font = Font(bold=True, color="2A1740")

    ws_sum["A1"] = "CarbonTrace EU CBAM Report — SAMPLE DATA ONLY (Illustrative)"
    ws_sum["A1"].font = Font(bold=True, size=13, color="6A1B9A")
    ws_sum.append(["Company", company_name])
    ws_sum.append(["Period", report.period])
    ws_sum.append(["Product", report.product])
    ws_sum.append(["Status", report.status])
    ws_sum.append(["Approved At", report.approved_at or "Pending"])
    ws_sum.append(["Embedded Emissions (tCO2e/t)", report.emissions_per_tonne])
    ws_sum.append(["Direct Breakdown (tCO2e/t)", report.breakdown_json.get("direct", 0)])
    ws_sum.append(["Indirect Breakdown (tCO2e/t)", report.breakdown_json.get("indirect", 0)])
    ws_sum.append(["Precursors Breakdown (tCO2e/t)", report.breakdown_json.get("precursors", 0)])
    ws_sum.append(["Actual Data Share (%)", round(report.basis_summary_json.get("actual", 0) * 100)])
    ws_sum.append(["EU Default Fallback (tCO2e/t)", report.eu_default_per_tonne])
    ws_sum.append(["Total Finished Tonnes", report.total_production_tonnes])
    ws_sum.append(["Exported EU Tonnes", report.exported_tonnes])

    savings = compute_money_saved(
        report.eu_default_per_tonne,
        report.emissions_per_tonne,
        report.exported_tonnes,
        carbon_price_eur,
    )
    ws_sum.append([f"Illustrative Savings (@EUR {carbon_price_eur:g}/t)", savings["moneySavedEur"]])
    ws_sum.column_dimensions["A"].width = 36
    ws_sum.column_dimensions["B"].width = 44

    # Sheet 2: Calculations
    ws_calc = wb.create_sheet("Calculations")
    calc_headers = [
        "ID",
        "Line Label",
        "Category",
        "Formula",
        "Input Record IDs",
        "Factor IDs",
        "Result",
        "Unit",
        "Basis",
    ]
    ws_calc.append(calc_headers)
    for col in range(1, len(calc_headers) + 1):
        cell = ws_calc.cell(row=1, column=col)
        cell.fill = header_fill
        cell.font = header_font

    for c in calculations:
        ws_calc.append(
            [
                c.id,
                c.label,
                c.category,
                c.formula_text,
                ", ".join(c.input_record_ids_json),
                ", ".join(c.factor_ids_json),
                c.result,
                c.unit,
                c.basis,
            ]
        )

    # Sheet 3: Evidence Ledger + Factors (every number linked to source document and page)
    ws_ev = wb.create_sheet("Evidence_Sources")
    ev_headers = [
        "Record ID",
        "Document ID",
        "Source Document",
        "Page",
        "Field",
        "Value",
        "Unit",
        "Status",
        "Confidence",
        "Exact Quote",
    ]
    ws_ev.append(ev_headers)
    for col in range(1, len(ev_headers) + 1):
        cell = ws_ev.cell(row=1, column=col)
        cell.fill = soft_fill
        cell.font = bold_font

    for r in ledger:
        ws_ev.append(
            [
                r.id,
                r.document_id,
                r.document_name,
                r.page,
                r.field,
                r.value,
                r.unit,
                r.status,
                r.confidence,
                r.quote,
            ]
        )

    ws_ev.append([])
    ws_ev.append(["Emission Factor ID", "Name", "Value", "Unit", "Year", "Source", "Illustrative"])
    for f in factors:
        ws_ev.append([f.id, f.name, f.value, f.unit, f.year, f.source, "Yes" if f.is_illustrative else "No"])

    for sheet in (ws_calc, ws_ev):
        for col in sheet.columns:
            max_len = max((len(str(c.value or "")) for c in col), default=12)
            col_letter = col[0].column_letter
            sheet.column_dimensions[col_letter].width = min(max_len + 4, 54)
        for row in sheet.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(vertical="top", wrap_text=True)

    output = BytesIO()
    wb.save(output)
    return output.getvalue()

