"""
Management command: sync_research_bridge

Matches notebook Objects to research Sources and propagates
research engine connections into the notebook Edge graph.

Usage:
  python manage.py sync_research_bridge
  python manage.py sync_research_bridge --verbose
  python manage.py sync_research_bridge --object-id 42
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        'Match notebook Objects to research Sources and propagate '
        'research connections into the notebook Edge graph.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose',
            action='store_true',
            default=False,
            help='Log each matched Object and edge count.',
        )
        parser.add_argument(
            '--object-id',
            type=int,
            default=None,
            help='Run the bridge for a single Object ID only.',
        )

    def handle(self, *args, **options):
        from apps.notebook.research_bridge import (
            propagate_research_connections,
            sync_all_objects,
        )

        verbose = options['verbose']
        object_id = options.get('object_id')

        if object_id:
            from apps.notebook.models import Object
            try:
                obj = Object.objects.get(pk=object_id, is_deleted=False)
            except Object.DoesNotExist:
                self.stderr.write(
                    self.style.ERROR(f'Object {object_id} not found or is deleted.')
                )
                return

            self.stdout.write(f'Running research bridge for Object {object_id}...')
            result = propagate_research_connections(obj)

            if result['source_matched']:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Matched: "{result["source_title"][:60]}"\n'
                        f'Edges created: {result["notebook_edges_created"]}'
                    )
                )
            else:
                self.stdout.write('No research Source match found for this Object.')
            return

        self.stdout.write('Running research bridge sync over all Objects...')
        stats = sync_all_objects(verbose=verbose)

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone.\n'
                f'  Objects processed : {stats["processed"]}\n'
                f'  Sources matched   : {stats["matched"]}\n'
                f'  Edges created     : {stats["edges_created"]}'
            )
        )
