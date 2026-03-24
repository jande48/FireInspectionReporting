"""
Build a PDF export of selected reports: cover (user + project) and per-report sections with fields and photos.
"""
import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage,
    PageBreak,
)
from .s3_utils import get_object_bytes


def _format_field_value(value, field_type):
    """Format a report field value for PDF display."""
    if value is None or value == '':
        return '—'
    if field_type == 'datetime':
        try:
            if isinstance(value, str):
                d = datetime.fromisoformat(value.replace('Z', '+00:00'))
            else:
                d = value
            return d.strftime('%b %d, %Y %I:%M %p') if hasattr(d, 'strftime') else str(value)
        except Exception:
            return str(value)
    if field_type == 'file':
        return ''  # Handled separately as images
    return str(value)


def _user_display_name(user):
    parts = [user.first_name or '', user.last_name or '']
    return ' '.join(parts).strip() or user.email


def build_reports_pdf(user, reports):
    """
    Build PDF bytes for the given user and list of reports (ordered).
    Reports must have project and project.template loaded (select_related).
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=12,
        spaceAfter=6,
    )
    body_style = styles['Normal']
    body_style.spaceAfter = 4
    prepared_by_style = ParagraphStyle(
        'PreparedByStyle',
        parent=body_style,
        alignment=0,  # TA_LEFT
        spaceAfter=4,
    )

    story = []

    # ----- Cover page -----
    story.append(Paragraph('Report Export', title_style))
    story.append(Spacer(1, 0.2 * inch))

    user_name = _user_display_name(user)
    prepared_by_lines = [
        Paragraph('Prepared by', heading_style),
        Paragraph(f'<b>Name:</b> {user_name}', prepared_by_style),
    ]
    if getattr(user, 'address', None) and user.address:
        prepared_by_lines.append(Paragraph(f'<b>Address:</b> {user.address}', prepared_by_style))
    if getattr(user, 'phone_number', None) and user.phone_number:
        prepared_by_lines.append(Paragraph(f'<b>Phone:</b> {user.phone_number}', prepared_by_style))
    if getattr(user, 'email', None) and user.email:
        prepared_by_lines.append(Paragraph(f'<b>Email:</b> {user.email}', prepared_by_style))
    if getattr(user, 'website', None) and user.website:
        prepared_by_lines.append(Paragraph(f'<b>Website:</b> {user.website}', prepared_by_style))
    cover_photo = Spacer(1.5 * inch, 1.5 * inch)
    if getattr(user, 'profile_photo_key', None) and user.profile_photo_key:
        profile_img_bytes = get_object_bytes(user.profile_photo_key)
        if profile_img_bytes:
            try:
                cover_photo = RLImage(io.BytesIO(profile_img_bytes), width=1.5 * inch, height=1.5 * inch)
            except Exception:
                # Ignore image rendering issues so export can still succeed.
                pass
    prepared_by_table = Table([[cover_photo, prepared_by_lines]], colWidths=[1.75 * inch, 5.0 * inch])
    prepared_by_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(prepared_by_table)

    # Primary project (first report's project)
    if reports:
        project = reports[0].project
        story.append(Spacer(1, 0.25 * inch))
        story.append(Paragraph('Project', heading_style))
        story.append(Paragraph(f'<b>Name:</b> {project.name}', body_style))
        if project.description:
            story.append(Paragraph(f'<b>Description:</b> {project.description}', body_style))
        if len(reports) > 1 and len({r.project_id for r in reports}) > 1:
            story.append(Paragraph('<i>This export includes reports from multiple projects.</i>', body_style))

    story.append(PageBreak())

    # ----- Per-report sections -----
    for report in reports:
        project = report.project
        template_fields = list(project.template.fields) if project.template else []
        data = report.data or {}

        # Report heading
        story.append(Paragraph(f'Report #{report.id}', title_style))
        story.append(Paragraph(f'Project: {project.name}', body_style))
        story.append(Paragraph(
                            f'Created: {report.created_at.strftime("%b %d, %Y")}',
                            body_style
                        ))
        story.append(Spacer(1, 0.15 * inch))

        # Data fields (text, datetime, choice only)
        field_rows = []
        for field in template_fields:
            ftype = field.get('type') or 'text'
            fname = field.get('name') or ''
            if not fname or ftype == 'file':
                continue
            value = data.get(fname)
            display = _format_field_value(value, ftype)
            if display:
                field_rows.append([fname, display])

        if field_rows:
            story.append(Paragraph('Details', heading_style))
            t = Table(field_rows, colWidths=[2 * inch, 4.5 * inch])
            t.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ]))
            story.append(t)
            story.append(Spacer(1, 0.2 * inch))

        # File fields: PHOTOS (2 per row)
        for field in template_fields:
            if field.get('type') != 'file':
                continue
            fname = field.get('name') or ''
            file_keys = data.get(fname)
            if not file_keys or not isinstance(file_keys, list):
                continue
            story.append(Paragraph(f'Photos – {fname}', heading_style))
            images = []
            for file_key in file_keys:
                if not isinstance(file_key, str):
                    continue
                img_bytes = get_object_bytes(file_key)
                if not img_bytes:
                    continue
                try:
                    img = RLImage(io.BytesIO(img_bytes), width=2.5 * inch, height=2.5 * inch)
                    images.append(img)
                except Exception:
                    continue
            # Two per row
            for i in range(0, len(images), 2):
                row = images[i : i + 2]
                if len(row) == 1:
                    row.append(Spacer(2.5 * inch, 2.5 * inch))
                t = Table([row], colWidths=[2.5 * inch, 2.5 * inch])
                t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
                story.append(t)
                story.append(Spacer(1, 0.15 * inch))
            if images:
                story.append(Spacer(1, 0.2 * inch))

        story.append(PageBreak())

    doc.build(story)
    return buffer.getvalue()
