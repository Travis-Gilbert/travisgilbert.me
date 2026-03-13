"""
Background task definitions for CommonPlace (django-rq).

Three queues:
  engine     - Connection engine runs (post-save, can take seconds with SBERT)
  ingestion  - Heavy file processing (SAM-2, advanced OCR, re-extraction)
  default    - Everything else (notifications, cleanup, etc.)

Usage:
  from apps.notebook.tasks import run_engine_task
  run_engine_task.delay(obj.pk, notebook_slug='urban-research')
"""

import logging
import mimetypes

try:
    import django_rq
except ImportError:  # pragma: no cover - exercised in lightweight test envs
    class _DjangoRQFallback:
        @staticmethod
        def job(*_args, **_kwargs):
            def decorator(func):
                func.delay = func
                func.func = func
                return func

            return decorator

    django_rq = _DjangoRQFallback()

from .job_status import (
    update_batch_job_status,
    update_engine_job_status,
    update_reorganize_job_status,
)

logger = logging.getLogger(__name__)


@django_rq.job('engine', timeout=600)
def run_engine_task(obj_pk: int, notebook_slug: str = '', engine_job_id: str = ''):
    """
    Run the full 7-pass connection engine for a single Object.

    Replaces the old threading.Thread approach in services.py.
    Jobs survive container restarts, are monitorable via django-rq
    admin, and retryable on failure.
    """
    from .engine import run_engine
    from .models import Notebook, Object

    try:
        obj = Object.objects.get(pk=obj_pk)
    except Object.DoesNotExist:
        logger.warning('Engine task: Object %s not found', obj_pk)
        if engine_job_id:
            update_engine_job_status(
                engine_job_id,
                'failed',
                error=f'Object {obj_pk} not found',
                object_id=obj_pk,
            )
        return

    notebook = None
    if notebook_slug:
        notebook = Notebook.objects.filter(slug=notebook_slug).first()

    try:
        if engine_job_id:
            update_engine_job_status(
                engine_job_id,
                'running',
                object_id=obj.pk,
                object_slug=obj.slug,
                object_title=obj.display_title,
            )

        summary = run_engine(obj, notebook=notebook)

        if engine_job_id:
            update_engine_job_status(
                engine_job_id,
                'complete',
                summary=summary,
                object_id=obj.pk,
                object_slug=obj.slug,
                object_title=obj.display_title,
            )
        logger.info('Engine task completed for Object %s (%s)', obj_pk, obj.title[:40])
    except Exception as exc:
        logger.error('Engine task failed for Object %s: %s', obj_pk, exc)
        if engine_job_id:
            update_engine_job_status(
                engine_job_id,
                'failed',
                error=str(exc),
                object_id=obj.pk,
                object_slug=obj.slug,
                object_title=obj.display_title,
            )
        raise  # Let RQ handle retry


@django_rq.job('ingestion', timeout=120)
def run_file_ingestion_task(obj_pk: int, file_key: str):
    """
    Heavy file processing after initial capture.

    Tier 1 extraction (Pillow, pytesseract, python-docx) runs synchronously
    during capture. This task handles Tier 2 (SAM-2 via Modal, deep OCR,
    re-extraction with better models).

    The Object already exists with basic metadata. This task enriches it.
    """
    from django.conf import settings

    from .models import Object

    try:
        obj = Object.objects.get(pk=obj_pk)
    except Object.DoesNotExist:
        logger.warning('Ingestion task: Object %s not found', obj_pk)
        return

    try:
        # If Modal is configured, offload heavy image analysis
        if settings.MODAL_ENABLED and _is_image_file(file_key):
            _run_modal_image_analysis(obj, file_key)
        else:
            logger.info(
                'Ingestion task: no heavy processing needed for %s', file_key
            )
    except Exception as exc:
        logger.error('Ingestion task failed for Object %s: %s', obj_pk, exc)
        raise


@django_rq.job('default', timeout=60)
def rebuild_sbert_index_task():
    """
    Rebuild the SBERT FAISS index and push it to Django cache.

    Called periodically or when corpus drifts by 100+ objects.
    Shared across workers when Redis cache is configured.
    """
    from .vector_store import _build_sbert_faiss_index

    logger.info('Rebuilding SBERT FAISS index...')
    try:
        result = _build_sbert_faiss_index()
        if result and result.get('index'):
            logger.info(
                'SBERT index rebuilt and cached: %d vectors', result['size']
            )
    except Exception as exc:
        logger.error('SBERT index rebuild failed: %s', exc)
        raise


@django_rq.job('default', timeout=30)
def notify_new_connections_task(obj_pk: int, edge_count: int):
    """
    Placeholder for real-time push notifications.

    When the engine discovers new connections, this task can:
    1. Publish to a Redis pub/sub channel (for SSE/WebSocket push)
    2. Store a notification record for the UI to poll
    3. Trigger a Sonner toast via the frontend context

    For now, just logs. Will be wired to SSE when the push
    infrastructure is built.
    """
    logger.info(
        'New connections notification: Object %s gained %d edges',
        obj_pk, edge_count,
    )


# -----------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------

def _is_image_file(file_key: str) -> bool:
    """Check if a file key points to an image."""
    image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.bmp')
    return any(file_key.lower().endswith(ext) for ext in image_extensions)


def _run_modal_image_analysis(obj, file_key: str):
    """
    Offload image analysis to Modal (GPU serverless).

    Modal runs Grounded SAM-2 for object detection/segmentation.
    Results are stored as Components on the Object.
    """
    from django.conf import settings
    from django.core.files.storage import default_storage

    logger.info('Running Modal image analysis for %s', file_key)

    # Read file from S3
    try:
        with default_storage.open(file_key, 'rb') as f:
            file_bytes = f.read()
    except Exception as exc:
        logger.warning('Could not read file %s from storage: %s', file_key, exc)
        return

    # Call Modal endpoint
    import httpx
    try:
        resp = httpx.post(
            f'https://{settings.MODAL_TOKEN_ID}--commonplace-vision.modal.run/analyze',
            content=file_bytes,
            headers={
                'Content-Type': 'application/octet-stream',
                'X-Filename': file_key.split('/')[-1],
            },
            timeout=60,
        )
        resp.raise_for_status()
        results = resp.json()

        # Store results as Components
        from .models import ComponentType
        comp_type, _ = ComponentType.objects.get_or_create(
            slug='image_analysis',
            defaults={
                'name': 'Image Analysis',
                'data_type': 'text',
                'triggers_node': True,
            },
        )
        obj.components.update_or_create(
            component_type=comp_type,
            key='sam2_analysis',
            defaults={
                'value': results,
                'sort_order': 99,
            },
        )
        logger.info('Modal analysis stored for Object %s: %s', obj.pk, list(results.keys()))

    except Exception as exc:
        logger.warning('Modal image analysis failed: %s', exc)


@django_rq.job('ingestion', timeout=1800)
def process_batch_ingestion(batch_job_id: str, file_data: list[dict], notebook_slug: str = ''):
    """
    Process a batch of uploaded files and run notebook self-organization after.
    """
    from .engine import run_engine
    from .models import Notebook
    from .self_organize import organize_batch
    from .services import quick_capture

    notebook = None
    if notebook_slug:
        notebook = Notebook.objects.filter(slug=notebook_slug).first()

    total_files = len(file_data)
    update_batch_job_status(
        batch_job_id,
        'running',
        notebook_slug=notebook_slug,
        total_files=total_files,
        processed_files=0,
        objects_created=0,
        failed_files=0,
    )

    created_objects = []
    failed_files = 0

    for index, file_entry in enumerate(file_data, start=1):
        filename = file_entry.get('filename', '')
        content = file_entry.get('content', b'')
        content_type = file_entry.get('content_type', '') or mimetypes.guess_type(filename)[0] or ''
        try:
            obj, _engine_job_id = quick_capture(
                title=filename,
                notebook_slug=notebook_slug,
                file_bytes=content,
                filename=filename,
                file_content_type=content_type,
                dispatch_engine=False,
            )
            created_objects.append(obj)
        except Exception as exc:
            failed_files += 1
            logger.warning('Batch ingestion failed for %s: %s', filename, exc)
        finally:
            update_batch_job_status(
                batch_job_id,
                'running',
                notebook_slug=notebook_slug,
                total_files=total_files,
                processed_files=index,
                objects_created=len(created_objects),
                failed_files=failed_files,
            )

    for obj in created_objects:
        try:
            run_engine(obj, notebook=notebook)
        except Exception as exc:
            logger.warning('Engine failed for %s: %s', obj.display_title, exc)

    organization = organize_batch(
        object_pks=[obj.pk for obj in created_objects],
        notebook=notebook,
    )

    result = update_batch_job_status(
        batch_job_id,
        'complete',
        notebook_slug=notebook_slug,
        total_files=total_files,
        processed_files=total_files,
        objects_created=len(created_objects),
        failed_files=failed_files,
        clusters_created=int(organization.get('clusters_created', 0) or 0),
    )
    return result


@django_rq.job('default', timeout=1200)
def run_periodic_reorganize_task(reorganize_job_id: str = ''):
    """
    Run periodic self-organization loops and capture status for polling.
    """
    from .self_organize import periodic_reorganize

    if reorganize_job_id:
        update_reorganize_job_status(reorganize_job_id, 'running')

    try:
        summary = periodic_reorganize()
        if reorganize_job_id:
            update_reorganize_job_status(
                reorganize_job_id,
                'complete',
                summary=summary,
            )
        return summary
    except Exception as exc:
        if reorganize_job_id:
            update_reorganize_job_status(
                reorganize_job_id,
                'failed',
                error=str(exc),
            )
        raise
