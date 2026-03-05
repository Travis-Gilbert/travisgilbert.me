"""
Run the connection engine across Objects.

Usage:
  python3 manage.py run_connection_engine                # Process active Objects
  python3 manage.py run_connection_engine --object 42    # Single Object by PK
  python3 manage.py run_connection_engine --all          # Every Object regardless of status
  python3 manage.py run_connection_engine --notebook creative-research  # Scope to Notebook
  python3 manage.py run_connection_engine --dry-run      # Preview without writing
"""

from django.core.management.base import BaseCommand, CommandError

from apps.notebook.engine import run_engine
from apps.notebook.models import Notebook, Object


class Command(BaseCommand):
    help = 'Run the connection engine to discover relationships between Objects.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--object',
            type=int,
            help='Process a single Object by primary key.',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Process all Objects (default: active only).',
        )
        parser.add_argument(
            '--notebook',
            type=str,
            help='Scope to a Notebook slug and use its engine config.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview which Objects would be processed without running the engine.',
        )

    def handle(self, *args, **options):
        notebook = None

        if options['notebook']:
            try:
                notebook = Notebook.objects.get(slug=options['notebook'])
                self.stdout.write(f'Using Notebook: {notebook.name}')
                if notebook.engine_config:
                    self.stdout.write(f'  Engine config: {notebook.engine_config}')
            except Notebook.DoesNotExist:
                raise CommandError(f'Notebook with slug="{options["notebook"]}" not found.')

        if options['object']:
            try:
                obj = Object.objects.get(pk=options['object'])
            except Object.DoesNotExist:
                raise CommandError(f'Object with pk={options["object"]} not found.')
            objects = [obj]
        elif options['all']:
            qs = Object.objects.all()
            if notebook:
                qs = qs.filter(notebook=notebook)
            objects = list(qs.order_by('-captured_at'))
        else:
            qs = Object.objects.filter(status='active')
            if notebook:
                qs = qs.filter(notebook=notebook)
            objects = list(qs.order_by('-captured_at'))

        if not objects:
            self.stdout.write('No Objects to process.')
            return

        self.stdout.write(f'Processing {len(objects)} Object(s)...\n')

        if options['dry_run']:
            for obj in objects:
                self.stdout.write(f'  Would process: [{obj.pk}] {obj.display_title[:60]}')
            self.stdout.write(self.style.WARNING(f'\nDry run: {len(objects)} Object(s) would be processed.'))
            return

        totals = {
            'entities_extracted': 0,
            'edges_from_entities': 0,
            'edges_from_shared': 0,
            'edges_from_topics': 0,
            'edges_from_tfidf': 0,
            'edges_from_semantic': 0,
            'objects_auto_created': 0,
            'connection_nodes_created': 0,
        }

        for obj in objects:
            self.stdout.write(f'\n  [{obj.pk}] {obj.display_title[:60]}')
            results = run_engine(obj, notebook=notebook)

            for key in totals:
                totals[key] += results.get(key, 0)

            if results.get('engines_active'):
                self.stdout.write(f'    Engines: {", ".join(results["engines_active"])}')
            if results['entities_extracted']:
                self.stdout.write(f'    Entities: {results["entities_extracted"]}')
            if results['edges_from_entities']:
                self.stdout.write(f'    Mention edges: {results["edges_from_entities"]}')
            if results['edges_from_shared']:
                self.stdout.write(f'    Shared entity edges: {results["edges_from_shared"]}')
            if results['edges_from_topics']:
                self.stdout.write(f'    Topic edges: {results["edges_from_topics"]}')
            if results.get('edges_from_tfidf'):
                self.stdout.write(f'    TF-IDF edges: {results["edges_from_tfidf"]}')
            if results.get('edges_from_semantic'):
                self.stdout.write(f'    Semantic edges: {results["edges_from_semantic"]}')
            if results['objects_auto_created']:
                self.stdout.write(
                    self.style.SUCCESS(f'    Auto-created Objects: {results["objects_auto_created"]}')
                )
            if results.get('connection_nodes_created'):
                self.stdout.write(f'    Connection Nodes: {results["connection_nodes_created"]}')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Totals across {len(objects)} Object(s):\n'
            f'  Entities extracted: {totals["entities_extracted"]}\n'
            f'  Mention edges: {totals["edges_from_entities"]}\n'
            f'  Shared entity edges: {totals["edges_from_shared"]}\n'
            f'  Topic edges: {totals["edges_from_topics"]}\n'
            f'  TF-IDF edges: {totals["edges_from_tfidf"]}\n'
            f'  Auto-created Objects: {totals["objects_auto_created"]}\n'
            f'  Connection Nodes: {totals["connection_nodes_created"]}'
        ))
