"""
Management command to publish all research data to the Next.js repo.

Usage:
    python manage.py publish_research
    python manage.py publish_research --dry-run
"""

from django.core.management.base import BaseCommand

from apps.mentions.models import Mention
from apps.publisher.publish import publish_all
from apps.research.models import ResearchThread, Source, SourceLink


class Command(BaseCommand):
    help = 'Publish research data as static JSON to the Next.js GitHub repo.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be published without committing.',
        )

    def handle(self, *args, **options):
        sources = Source.objects.public().count()
        links = SourceLink.objects.filter(source__public=True).count()
        threads = ResearchThread.objects.public().count()
        mentions = Mention.objects.public().count()

        self.stdout.write(
            f'Found {sources} public sources, {links} links, '
            f'{threads} public threads, {mentions} public mentions.'
        )

        if options['dry_run']:
            self.stdout.write(self.style.WARNING('Dry run: no files committed.'))
            return

        result = publish_all()

        if result['success']:
            self.stdout.write(self.style.SUCCESS(
                f'Published successfully. Commit: {result["commit_sha"][:8]}'
            ))
        else:
            self.stdout.write(self.style.ERROR(
                f'Publish failed: {result["error"]}'
            ))
