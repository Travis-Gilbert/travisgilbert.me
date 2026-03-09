"""
Multi-format file extraction for CommonPlace Object ingestion.

Supported formats:
  PDF   - spacy-layout / pypdf (existing, delegated to pdf_ingestion.py)
  DOCX  - python-docx (structure-aware: headings, paragraphs, tables)
  XLSX  - openpyxl (sheet names, cell data as structured text)
  PPTX  - python-pptx (slide titles + body text)
  Images - Pillow for metadata, pytesseract for OCR, optional scikit-image
  TXT/MD/CSV/HTML - direct text read
  Other - empty result with filename as title

Never raises. Returns:
  {
    'title': str,
    'body': str,
    'author': str,
    'sections': list[dict],   # [{heading, body}]
    'metadata': dict,          # format-specific metadata
    'char_count': int,
    'method': str,             # 'docx' | 'xlsx' | 'pptx' | 'image_ocr' | ...
    'thumbnails': list[str],   # base64-encoded PNG thumbnails
  }
"""

import logging
import mimetypes
from pathlib import Path
from typing import Any

from .pdf_ingestion import extract_pdf_text

logger = logging.getLogger(__name__)


def extract_file_content(file_bytes: bytes, filename: str, mime_type: str = '') -> dict[str, Any]:
    """
    Route file to the appropriate extractor based on MIME type or extension.
    """
    if not mime_type:
        mime_type, _ = mimetypes.guess_type(filename)
        mime_type = mime_type or ''

    ext = Path(filename).suffix.lower()

    # PDF
    if mime_type == 'application/pdf' or ext == '.pdf':
        return extract_pdf_text(file_bytes)

    # DOCX
    if mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' or ext in ('.docx', '.doc'):
        return _extract_docx(file_bytes)

    # XLSX
    if mime_type == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or ext in ('.xlsx', '.xls'):
        return _extract_xlsx(file_bytes)

    # PPTX
    if mime_type == 'application/vnd.openxmlformats-officedocument.presentationml.presentation' or ext in ('.pptx', '.ppt'):
        return _extract_pptx(file_bytes)

    # Images
    if mime_type.startswith('image/') or ext in ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp'):
        return _extract_image(file_bytes, filename, mime_type)

    # Plain text family
    if mime_type.startswith('text/') or ext in ('.txt', '.md', '.csv', '.json', '.xml', '.yaml', '.yml', '.toml', '.html', '.htm'):
        return _extract_text(file_bytes, ext)

    logger.warning('Unsupported file type: %s (%s)', filename, mime_type)
    result = _empty_result('unsupported')
    result['title'] = Path(filename).stem
    return result


def _empty_result(method: str) -> dict[str, Any]:
    return {
        'title': '',
        'body': '',
        'author': '',
        'sections': [],
        'metadata': {},
        'char_count': 0,
        'method': method,
        'thumbnails': [],
    }


# ─── DOCX ────────────────────────────────────────────────────────────────────


def _extract_docx(file_bytes: bytes) -> dict[str, Any]:
    """
    Extract structured content from a DOCX file.
    Headings become section delimiters. Tables render as pipe-separated rows.
    Core properties supply title and author metadata.
    """
    try:
        import io
        from docx import Document

        doc = Document(io.BytesIO(file_bytes))
        props = doc.core_properties
        title = (props.title or '').strip()
        author = (props.author or '').strip()

        sections = []
        current_heading = ''
        current_body: list[str] = []
        all_text: list[str] = []

        for para in doc.paragraphs:
            text = para.text.strip()
            if not text:
                continue

            style_name = (para.style.name or '').lower()

            if 'heading' in style_name:
                if current_heading or current_body:
                    sections.append({
                        'heading': current_heading,
                        'body': '\n'.join(current_body),
                    })
                    current_body = []
                current_heading = text
                if not title:
                    title = text
            else:
                current_body.append(text)

            all_text.append(text)

        if current_heading or current_body:
            sections.append({
                'heading': current_heading,
                'body': '\n'.join(current_body),
            })

        # Tables as pipe-delimited text
        table_text: list[str] = []
        for table in doc.tables:
            rows = []
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]
                rows.append(' | '.join(cells))
            if rows:
                table_text.append('\n'.join(rows))

        body = '\n\n'.join(all_text)
        if table_text:
            body += '\n\n---\n\n' + '\n\n'.join(table_text)

        if not title and all_text:
            title = all_text[0][:80]

        return {
            'title': title,
            'body': body,
            'author': author,
            'sections': sections,
            'metadata': {
                'section_count': len(doc.sections),
                'table_count': len(doc.tables),
                'created': str(props.created) if props.created else '',
                'modified': str(props.modified) if props.modified else '',
            },
            'char_count': len(body),
            'method': 'docx',
            'thumbnails': [],
        }
    except Exception as exc:
        logger.warning('DOCX extraction failed: %s', exc)
        return _empty_result('docx_failed')


# ─── XLSX ────────────────────────────────────────────────────────────────────


def _extract_xlsx(file_bytes: bytes) -> dict[str, Any]:
    """
    Extract structured content from an XLSX spreadsheet.
    Each sheet becomes a section. Cell values are joined as tab-separated rows.
    """
    try:
        import io
        import openpyxl

        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        sections = []
        all_text: list[str] = []

        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            rows: list[str] = []
            for row in ws.iter_rows(values_only=True):
                cells = [str(cell) if cell is not None else '' for cell in row]
                if any(cells):
                    rows.append('\t'.join(cells))

            body = '\n'.join(rows)
            sections.append({'heading': sheet_name, 'body': body})
            all_text.append(f'# {sheet_name}\n{body}')

        full_body = '\n\n'.join(all_text)
        title = wb.sheetnames[0] if wb.sheetnames else ''

        return {
            'title': title,
            'body': full_body,
            'author': '',
            'sections': sections,
            'metadata': {'sheet_count': len(wb.sheetnames)},
            'char_count': len(full_body),
            'method': 'xlsx',
            'thumbnails': [],
        }
    except Exception as exc:
        logger.warning('XLSX extraction failed: %s', exc)
        return _empty_result('xlsx_failed')


# ─── PPTX ────────────────────────────────────────────────────────────────────


def _extract_pptx(file_bytes: bytes) -> dict[str, Any]:
    """
    Extract text from a PowerPoint presentation.
    Each slide becomes a section with its title and body text.
    """
    try:
        import io
        from pptx import Presentation

        prs = Presentation(io.BytesIO(file_bytes))
        sections = []
        all_text: list[str] = []
        presentation_title = ''

        for i, slide in enumerate(prs.slides, 1):
            slide_title = ''
            slide_body_parts: list[str] = []

            for shape in slide.shapes:
                if not shape.has_text_frame:
                    continue
                text = shape.text_frame.text.strip()
                if not text:
                    continue

                # Title placeholder (placeholder type 15 or name contains 'title')
                is_title = (
                    hasattr(shape, 'placeholder_format')
                    and shape.placeholder_format is not None
                    and shape.placeholder_format.idx in (0, 1)
                )
                if is_title and not slide_title:
                    slide_title = text
                    if i == 1 and not presentation_title:
                        presentation_title = text
                else:
                    slide_body_parts.append(text)

            body = '\n'.join(slide_body_parts)
            heading = slide_title or f'Slide {i}'
            sections.append({'heading': heading, 'body': body})
            chunk = f'# {heading}\n{body}' if body else f'# {heading}'
            all_text.append(chunk)

        full_body = '\n\n'.join(all_text)

        return {
            'title': presentation_title,
            'body': full_body,
            'author': '',
            'sections': sections,
            'metadata': {'slide_count': len(prs.slides)},
            'char_count': len(full_body),
            'method': 'pptx',
            'thumbnails': [],
        }
    except Exception as exc:
        logger.warning('PPTX extraction failed: %s', exc)
        return _empty_result('pptx_failed')


# ─── Images ──────────────────────────────────────────────────────────────────


def _extract_image(file_bytes: bytes, filename: str, mime_type: str) -> dict[str, Any]:
    """
    Image ingestion with two tiers:
    Tier 1: Pillow for metadata and thumbnail + pytesseract OCR (always attempted)
    Tier 2: scikit-image dominant color extraction (when installed)

    SAM-2 segmentation is intentionally async-only and not called here.
    """
    result = _empty_result('image')
    result['title'] = Path(filename).stem

    try:
        import base64
        import io
        from PIL import Image
        from PIL.ExifTags import TAGS

        img = Image.open(io.BytesIO(file_bytes))
        width, height = img.size

        # EXIF metadata
        exif_data: dict[str, str] = {}
        try:
            raw_exif = img.getexif()
            for tag_id, value in raw_exif.items():
                tag_name = TAGS.get(tag_id, str(tag_id))
                exif_data[tag_name] = str(value)
        except Exception:
            pass

        result['metadata'] = {
            'width': width,
            'height': height,
            'format': img.format or mime_type.split('/')[-1],
            'mode': img.mode,
            'exif': exif_data,
            'sam_available': False,
        }

        # Thumbnail (max 200px, PNG)
        thumb = img.copy()
        thumb.thumbnail((200, 200))
        thumb_buf = io.BytesIO()
        thumb_rgb = thumb.convert('RGB')
        thumb_rgb.save(thumb_buf, format='PNG')
        result['thumbnails'] = [base64.b64encode(thumb_buf.getvalue()).decode()]

        # OCR with pytesseract
        try:
            import pytesseract
            ocr_text = pytesseract.image_to_string(img).strip()
            if ocr_text and len(ocr_text) > 10:
                result['body'] = ocr_text
                result['char_count'] = len(ocr_text)
                result['method'] = 'image_ocr'
        except ImportError:
            logger.debug('pytesseract not installed; skipping OCR')
        except Exception as ocr_exc:
            logger.warning('OCR failed: %s', ocr_exc)

        # Tier 2: dominant colors via scikit-image + sklearn
        result = _try_dominant_colors(result, img)

    except Exception as exc:
        logger.warning('Image extraction failed: %s', exc)

    return result


def _try_dominant_colors(result: dict[str, Any], img) -> dict[str, Any]:
    """
    Optional Tier 2: extract dominant colors with KMeans clustering.
    Runs only when scikit-learn is installed. Lightweight, synchronous.
    """
    try:
        import numpy as np
        from sklearn.cluster import KMeans

        img_rgb = img.convert('RGB')
        pixels = np.array(img_rgb).reshape(-1, 3).astype(float)

        # Subsample large images for speed
        if len(pixels) > 2000:
            indices = np.random.default_rng(42).choice(len(pixels), 2000, replace=False)
            pixels = pixels[indices]

        kmeans = KMeans(n_clusters=4, n_init=3, random_state=42)
        kmeans.fit(pixels)

        dominant = [
            '#{:02x}{:02x}{:02x}'.format(int(c[0]), int(c[1]), int(c[2]))
            for c in kmeans.cluster_centers_
        ]
        result['metadata']['dominant_colors'] = dominant
        if result['method'] == 'image':
            result['method'] = 'image_color'

    except ImportError:
        pass
    except Exception as exc:
        logger.debug('Dominant color extraction skipped: %s', exc)

    return result


# ─── Plain text family ───────────────────────────────────────────────────────


def _extract_text(file_bytes: bytes, ext: str) -> dict[str, Any]:
    """
    Read plain-text files (TXT, MD, CSV, JSON, YAML, HTML, etc.).
    For HTML, strips tags with BeautifulSoup if available; falls back to raw decode.
    """
    try:
        raw = file_bytes.decode('utf-8', errors='replace')

        if ext in ('.html', '.htm'):
            raw = _strip_html(raw)

        lines = [line.strip() for line in raw.splitlines() if line.strip()]
        title = lines[0][:80] if lines else ''
        body = '\n'.join(lines)

        return {
            'title': title,
            'body': body,
            'author': '',
            'sections': [],
            'metadata': {'extension': ext},
            'char_count': len(body),
            'method': 'text',
            'thumbnails': [],
        }
    except Exception as exc:
        logger.warning('Text extraction failed: %s', exc)
        return _empty_result('text_failed')


def _strip_html(raw: str) -> str:
    """Strip HTML tags. Uses BeautifulSoup when available, regex fallback."""
    try:
        from bs4 import BeautifulSoup
        return BeautifulSoup(raw, 'html.parser').get_text(separator='\n')
    except ImportError:
        import re
        return re.sub(r'<[^>]+>', '', raw)
