"""
Scheduler utilities for notebook background maintenance jobs.
"""

from __future__ import annotations

import logging
import os
from datetime import timedelta

from django.utils import timezone

logger = logging.getLogger(__name__)

PERIODIC_REORGANIZE_FUNC = 'apps.notebook.self_organize.periodic_reorganize'
PERIODIC_REORGANIZE_INTERVAL_SECONDS = 86400


def _scheduler_enabled() -> bool:
    return os.environ.get('ENABLE_SELF_ORGANIZE_SCHEDULER', '').lower() in ('1', 'true', 'yes')


def _next_run(hour_utc: int, minute_utc: int):
    now = timezone.now()
    target = now.replace(hour=hour_utc, minute=minute_utc, second=0, microsecond=0)
    if target <= now:
        target = target + timedelta(days=1)
    return target


def _job_matches(job) -> bool:
    func_name = getattr(job, 'func_name', '') or ''
    if PERIODIC_REORGANIZE_FUNC in func_name:
        return True
    # Fallback for jobs serialized with dotted import paths or wrappers.
    return PERIODIC_REORGANIZE_FUNC in str(job)


def ensure_periodic_reorganize_schedule(force: bool = False) -> dict:
    """
    Ensure one daily periodic_reorganize job exists in the default queue scheduler.
    """
    if not force and not _scheduler_enabled():
        return {'enabled': False, 'created': False, 'reason': 'disabled_by_env'}

    try:
        import django_rq
    except Exception:
        return {'enabled': False, 'created': False, 'reason': 'django_rq_unavailable'}

    try:
        scheduler = django_rq.get_scheduler('default')
    except Exception as exc:
        logger.warning('Could not load RQ scheduler: %s', exc)
        return {'enabled': True, 'created': False, 'reason': f'scheduler_error:{exc}'}

    try:
        existing_jobs = [job for job in scheduler.get_jobs() if _job_matches(job)]
    except Exception as exc:
        logger.warning('Could not list scheduler jobs: %s', exc)
        existing_jobs = []

    if existing_jobs:
        return {
            'enabled': True,
            'created': False,
            'reason': 'already_scheduled',
            'job_count': len(existing_jobs),
        }

    hour = int(os.environ.get('SELF_ORGANIZE_SCHEDULE_HOUR_UTC', '3'))
    minute = int(os.environ.get('SELF_ORGANIZE_SCHEDULE_MINUTE_UTC', '0'))
    scheduled_time = _next_run(hour, minute)

    scheduler.schedule(
        scheduled_time=scheduled_time,
        func=PERIODIC_REORGANIZE_FUNC,
        interval=PERIODIC_REORGANIZE_INTERVAL_SECONDS,
        repeat=None,
        queue_name='default',
        timeout=900,
        result_ttl=3600,
    )
    logger.info(
        'Scheduled periodic_reorganize at %s UTC (daily interval).',
        scheduled_time.isoformat(),
    )
    return {
        'enabled': True,
        'created': True,
        'reason': 'scheduled',
        'scheduled_time': scheduled_time.isoformat(),
    }
