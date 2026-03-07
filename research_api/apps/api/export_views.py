"""
Export and Import endpoints for research sources.

GET  /api/v1/export/   Multi-format source export.
POST /api/v1/import/   Multi-format source import.
"""

from django.http import HttpResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.api.exporters import EXPORT_FORMATS
from apps.api.importers import IMPORT_FORMATS, create_sources_from_records
from apps.api.models import ImportJob
from apps.research.models import Source


@api_view(['GET'])
def export_sources(request):
    """
    Export sources in various formats.

    Supported: json, bibtex, ris, opml, csv, json-ld.
    Optional filters: type, tag, thread.
    """
    fmt = request.query_params.get('format', '').strip().lower()
    if fmt not in EXPORT_FORMATS:
        return Response(
            {
                'error': f'Invalid format. Choose from: {", ".join(sorted(EXPORT_FORMATS))}.',
            },
            status=400,
        )

    qs = Source.objects.public()

    source_type = request.query_params.get('type', '').strip()
    if source_type:
        qs = qs.filter(source_type=source_type)

    tag = request.query_params.get('tag', '').strip()
    if tag:
        qs = qs.filter(tags__icontains=tag)

    thread_slug = request.query_params.get('thread', '').strip()
    if thread_slug:
        qs = qs.filter(
            thread_entries__thread__slug=thread_slug,
        ).distinct()

    qs = qs.order_by('title')

    fmt_config = EXPORT_FORMATS[fmt]
    content = fmt_config['fn'](qs)
    content_type = fmt_config['content_type']
    extension = fmt_config['extension']

    response = HttpResponse(content, content_type=f'{content_type}; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="sources.{extension}"'
    return response


@api_view(['POST'])
def import_sources(request):
    """
    Import sources from uploaded file.

    Supported formats: bibtex, ris, csv, opml, json.
    Requires can_import flag on the API key.
    """
    api_key = getattr(request, 'api_key', None)
    if not api_key or not api_key.can_import:
        return Response(
            {'error': 'Import requires an API key with can_import permission.'},
            status=403,
        )

    fmt = request.data.get('format', '').strip().lower()
    if fmt not in IMPORT_FORMATS:
        return Response(
            {
                'error': f'Invalid format. Choose from: {", ".join(sorted(IMPORT_FORMATS))}.',
            },
            status=400,
        )

    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return Response(
            {'error': 'No file uploaded. Include a "file" field.'},
            status=400,
        )

    dry_run = request.data.get('dry_run', '').lower() in ('true', '1', 'yes')

    file_content = uploaded_file.read()
    parser_fn = IMPORT_FORMATS[fmt]
    records, parse_errors = parser_fn(file_content)

    created, skipped, create_errors, preview = create_sources_from_records(
        records, dry_run=dry_run,
    )

    all_errors = parse_errors + create_errors

    # Log the import job
    ImportJob.objects.create(
        api_key=api_key,
        format=fmt,
        filename=uploaded_file.name or 'unknown',
        record_count=len(records),
        created_count=created,
        skipped_count=skipped,
        error_count=len(all_errors),
        errors=all_errors,
        dry_run=dry_run,
    )

    result = {
        'status': 'completed_with_errors' if all_errors else 'completed',
        'created': created,
        'skipped': skipped,
        'errors': all_errors,
    }

    if dry_run:
        result['preview'] = preview

    return Response(result, status=201 if created and not dry_run else 200)
