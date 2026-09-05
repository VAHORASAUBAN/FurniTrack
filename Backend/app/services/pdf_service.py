"""PDF generation for Bill/Invoice print — design doc §6 names WeasyPrint,
but WeasyPrint's Python wheel dynamically loads native Pango/GObject
libraries at import time that this Windows dev machine doesn't have (and
can't get from pip) — it installs cleanly, then fails at the first render.
reportlab has zero native dependencies and renders identically on any
machine, at the cost of a table/flowable layout API instead of a Jinja2
HTML template; the actual document shape (header, partner block, line
table, totals) is the same either way.
"""
from datetime import datetime
from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import Document

# Same palette as the web app's ledger identity (Frontend/src/index.css).
_INK = colors.HexColor("#241d15")
_INK_2 = colors.HexColor("#5c5445")
_INK_3 = colors.HexColor("#8d8371")
_ACCENT = colors.HexColor("#285e48")
_BRASS = colors.HexColor("#a9762f")
_RULE = colors.HexColor("#e2d8c2")
_PAPER = colors.HexColor("#f4efe3")

_DOC_TITLE = {
    "VENDOR_BILL": "VENDOR BILL",
    "CUSTOMER_INVOICE": "TAX INVOICE",
}


def _money(value: Decimal) -> str:
    return f"Rs. {value:,.2f}"


def _qty(value: Decimal) -> str:
    """3-decimal quantities (design doc's Qty type) with trailing zeros
    trimmed for print - "4.000" reads as "4", "2.500" as "2.5"."""
    text = f"{value:.3f}"
    return text.rstrip("0").rstrip(".") if "." in text else text


def build_document_pdf(document: Document, company_name: str) -> bytes:
    """`document` must already have `.lines`, `.partner`, and `.balance`
    (document_service.attach_balance) populated."""
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=18 * mm, rightMargin=18 * mm,
        title=f"{document.doc_type.value} {document.doc_number}",
    )
    styles = getSampleStyleSheet()
    company_style = ParagraphStyle("Company", parent=styles["Heading1"], fontSize=18, textColor=_INK, spaceAfter=0)
    tagline_style = ParagraphStyle("Tagline", parent=styles["Normal"], fontSize=9, textColor=_INK_3)
    doc_title_style = ParagraphStyle(
        "DocTitle", parent=styles["Heading1"], fontSize=16, textColor=_ACCENT, alignment=TA_RIGHT, spaceAfter=2
    )
    doc_number_style = ParagraphStyle(
        "DocNumber", parent=styles["Normal"], fontSize=11, textColor=_INK_2, alignment=TA_RIGHT
    )
    label_style = ParagraphStyle("Label", parent=styles["Normal"], fontSize=9, textColor=_INK_3)
    body_style = ParagraphStyle("Body", parent=styles["Normal"], fontSize=10, textColor=_INK, leading=14)
    right_style = ParagraphStyle("Right", parent=body_style, alignment=TA_RIGHT)

    elements = []

    header = Table(
        [[
            Paragraph(company_name, company_style),
            Paragraph(_DOC_TITLE.get(document.doc_type.value, document.doc_type.value.replace("_", " ")), doc_title_style),
        ], [
            Paragraph("Ledger &amp; Accounts", tagline_style),
            Paragraph(document.doc_number, doc_number_style),
        ]],
        colWidths=[100 * mm, 74 * mm],
    )
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    elements.append(header)
    elements.append(Spacer(1, 4 * mm))
    elements.append(Table([[""]], colWidths=[174 * mm], rowHeights=[0.75],
                           style=TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.75, _ACCENT)])))
    elements.append(Spacer(1, 6 * mm))

    partner = document.partner
    address_lines = [line for line in [partner.street, ", ".join(filter(None, [partner.city, partner.state, partner.pincode]))] if line]
    partner_block = [Paragraph("BILL TO" if document.doc_type.value == "CUSTOMER_INVOICE" else "VENDOR", label_style),
                      Paragraph(f"<b>{partner.name}</b>", body_style)]
    for line in address_lines:
        partner_block.append(Paragraph(line, body_style))
    if partner.email:
        partner_block.append(Paragraph(partner.email, body_style))
    if partner.mobile:
        partner_block.append(Paragraph(partner.mobile, body_style))

    meta_rows = [["Date", document.doc_date.strftime("%d %b %Y")]]
    if document.due_date:
        meta_rows.append(["Due Date", document.due_date.strftime("%d %b %Y")])
    if document.reference:
        meta_rows.append(["Reference", document.reference])
    meta_rows.append(["Status", document.status.value.title()])
    meta_table = Table(
        [[Paragraph(f"<font color='#8d8371'>{k}</font>", right_style), Paragraph(v, right_style)] for k, v in meta_rows],
        colWidths=[30 * mm, 44 * mm],
    )
    meta_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))

    info_table = Table([[partner_block, meta_table]], colWidths=[100 * mm, 74 * mm])
    info_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(info_table)
    elements.append(Spacer(1, 8 * mm))

    line_header = ["#", "Description", "Qty", "Unit Price", "Tax %", "Total"]
    line_rows = [line_header]
    for line in document.lines:
        description = line.description or (line.product.name if line.product else "")
        line_rows.append([
            str(line.line_no),
            description,
            _qty(line.quantity),
            _money(line.unit_price),
            f"{line.tax_rate:.2f}%",
            _money(line.total),
        ])
    lines_table = Table(line_rows, colWidths=[8 * mm, 70 * mm, 18 * mm, 28 * mm, 20 * mm, 30 * mm], repeatRows=1)
    lines_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), _PAPER),
        ("TEXTCOLOR", (0, 0), (-1, 0), _INK_3),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 1), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), _INK),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.75, _RULE),
        ("LINEBELOW", (0, 1), (-1, -2), 0.4, _RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    elements.append(lines_table)
    elements.append(Spacer(1, 6 * mm))

    balance = document.balance or {}
    totals_rows = [
        ["Untaxed Amount", _money(document.untaxed_amount)],
        ["Tax", _money(document.tax_amount)],
        ["Total", _money(document.total_amount)],
    ]
    if balance:
        totals_rows.append(["Paid", _money(balance["amount_paid"])])
        totals_rows.append(["Amount Due", _money(balance["amount_due"])])
    totals_table = Table(
        [[Paragraph(k, label_style), Paragraph(v, right_style)] for k, v in totals_rows],
        colWidths=[110 * mm, 64 * mm],
    )
    style_cmds = [("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 2)]
    total_row_idx = 2
    style_cmds += [
        ("LINEABOVE", (0, total_row_idx), (-1, total_row_idx), 0.75, _INK_3),
        ("FONTNAME", (0, total_row_idx), (-1, total_row_idx), "Helvetica-Bold"),
        ("FONTSIZE", (0, total_row_idx), (-1, total_row_idx), 11),
    ]
    if balance:
        due_row_idx = len(totals_rows) - 1
        style_cmds += [
            ("FONTNAME", (0, due_row_idx), (-1, due_row_idx), "Helvetica-Bold"),
            ("TEXTCOLOR", (1, due_row_idx), (1, due_row_idx), _BRASS if Decimal(str(balance["amount_due"])) > 0 else _ACCENT),
        ]
    totals_table.setStyle(TableStyle(style_cmds))
    elements.append(totals_table)

    if document.notes:
        elements.append(Spacer(1, 8 * mm))
        elements.append(Paragraph("Notes", label_style))
        elements.append(Paragraph(document.notes, body_style))

    def _footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(_INK_3)
        canvas.drawString(
            18 * mm, 12 * mm,
            f"Generated by {company_name} Accounting on {datetime.now().strftime('%d %b %Y %H:%M')}",
        )
        canvas.restoreState()

    doc.build(elements, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()
