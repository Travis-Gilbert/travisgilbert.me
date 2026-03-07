"""
Management command to check the health of all source URLs.

Performs concurrent HEAD requests (falling back to GET on 405),
checks the Wayback Machine for dead URLs, and records results
as HealthCheck instances.

Usage:
    python manage.py check_source_health
    python manage.py check_source_health --batch-size 20
    python manage.py check_source_health --dry-run
"""

import asyncio
import logging

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

WAYBACK_CDX_URL = 'https://web.archive.org/cdx/search/cdx'
DEFAULT_TIMEOUT = 10
DEFAULT_BATCH_SIZE = 10


async def check_single_source(client, source_url):
    """
    Check a single URL. HEAD first, fall back to GET on 405.
    Returns (status_code, is_alive, redirect_url, error_message).
    """
    import httpx

    try:
        response = await client.head(
            source_url,
            follow_redirects=True,
            timeout=DEFAULT_TIMEOUT,
        )

        if response.status_code == 405:
            response = await client.get(
                source_url,
                follow_redirects=True,
                timeout=DEFAULT_TIMEOUT,
            )

        redirect_url = ''
        if response.history:
            redirect_url = str(response.url)

        is_alive = response.status_code < 400
        return response.status_code, is_alive, redirect_url, ''

    except httpx.TimeoutException:
        return None, False, '', 'Connection timed out'
    except httpx.ConnectError:
        return None, False, '', 'Connection refused'
    except httpx.TooManyRedirects:
        return None, False, '', 'Too many redirects'
    except Exception as exc:
        return None, False, '', str(exc)[:500]


async def check_wayback(client, source_url):
    """
    Check if the Wayback Machine has an archived copy.
    Returns (has_archive, archive_url).
    """
    try:
        response = await client.get(
            WAYBACK_CDX_URL,
            params={
                'url': source_url,
                'output': 'json',
                'limit': 1,
                'fl': 'timestamp,original',
            },
            timeout=10,
        )
        if response.status_code == 200:
            data = response.json()
            if len(data) > 1:
                timestamp = data[1][0]
                original = data[1][1]
                archive_url = f'https://web.archive.org/web/{timestamp}/{original}'
                return True, archive_url
    except Exception:
        pass
    return False, ''


async def process_batch(sources_batch):
    """Process a batch of sources concurrently."""
    import httpx

    results = []
    async with httpx.AsyncClient(
        headers={'User-Agent': 'ResearchAPI-HealthChecker/1.0'},
    ) as client:
        tasks = []
        for source in sources_batch:
            tasks.append(check_and_archive(client, source))
        results = await asyncio.gather(*tasks)
    return results


async def check_and_archive(client, source):
    """Check a source URL and look up Wayback Machine if dead."""
    status_code, is_alive, redirect_url, error_message = await check_single_source(
        client, source.url,
    )

    has_archive = False
    archive_url = ''

    if not is_alive:
        has_archive, archive_url = await check_wayback(client, source.url)

    return {
        'source': source,
        'status_code': status_code,
        'is_alive': is_alive,
        'redirect_url': redirect_url,
        'has_archive': has_archive,
        'archive_url': archive_url,
        'error_message': error_message,
    }


class Command(BaseCommand):
    help = 'Check the health of all source URLs and record results.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--batch-size',
            type=int,
            default=DEFAULT_BATCH_SIZE,
            help=f'Number of concurrent requests (default: {DEFAULT_BATCH_SIZE}).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Check URLs but do not save HealthCheck records.',
        )

    def handle(self, *args, **options):
        from apps.api.models import HealthCheck
        from apps.research.models import Source

        batch_size = options['batch_size']
        dry_run = options['dry_run']

        sources = list(
            Source.objects.public()
            .exclude(url='')
            .exclude(url__isnull=True)
            .order_by('title')
        )

        if not sources:
            self.stdout.write('No sources with URLs found.')
            return

        self.stdout.write(f'Checking {len(sources)} source URLs (batch size: {batch_size})...')

        all_results = []
        for i in range(0, len(sources), batch_size):
            batch = sources[i:i + batch_size]
            batch_results = asyncio.run(process_batch(batch))
            all_results.extend(batch_results)
            self.stdout.write(f'  Processed {min(i + batch_size, len(sources))}/{len(sources)}')

        alive_count = sum(1 for r in all_results if r['is_alive'])
        dead_count = sum(1 for r in all_results if not r['is_alive'])
        archived_count = sum(1 for r in all_results if r['has_archive'])

        if not dry_run:
            health_checks = [
                HealthCheck(
                    source=r['source'],
                    status_code=r['status_code'],
                    is_alive=r['is_alive'],
                    redirect_url=r['redirect_url'],
                    has_archive=r['has_archive'],
                    archive_url=r['archive_url'],
                    error_message=r['error_message'],
                )
                for r in all_results
            ]
            HealthCheck.objects.bulk_create(health_checks)
            self.stdout.write(self.style.SUCCESS(
                f'Created {len(health_checks)} HealthCheck records.'
            ))
        else:
            self.stdout.write('[DRY RUN] No records saved.')

        self.stdout.write(
            f'Results: {alive_count} alive, {dead_count} dead, '
            f'{archived_count} with Wayback archive.'
        )
