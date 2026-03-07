"""
Rebuild full-text search vectors for all Source records.

Usage:
    python manage.py rebuild_search_index
    python manage.py rebuild_search_index --dry-run

Only runs on PostgreSQL. Prints a warning and exits on SQLite.
"""

from django.core.management.base import BaseCommand
from django.db import connection

from apps.research.models import Source


class Command(BaseCommand):
    help = 'Rebuild full-text search vectors for all sources.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Count sources without updating.',
        )

    def handle(self, *args, **options):
        if connection.vendor != 'postgresql':
            self.stdout.write(self.style.WARNING(
                'Search vectors require PostgreSQL. '
                'Skipping on %s.' % connection.vendor
            ))
            return

        from django.contrib.postgres.search import SearchVector

        count = Source.objects.count()
        if options['dry_run']:
            self.stdout.write(
                f'Would rebuild search vectors for {count} sources.'
            )
            return

        Source.objects.update(
            search_vector=(
                SearchVector('title', weight='A')
                + SearchVector('creator', weight='B')
                + SearchVector('public_annotation', weight='C')
                + SearchVector('publication', weight='C')
            )
        )

        self.stdout.write(self.style.SUCCESS(
            f'Rebuilt search vectors for {count} sources.'
        ))
