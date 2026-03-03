"""
Run the connection engine across KnowledgeNodes.

Usage:
  python3 manage.py run_connection_engine           # Process all inbox + active nodes
  python3 manage.py run_connection_engine --node 42  # Process a single node by PK
  python3 manage.py run_connection_engine --all      # Process every node regardless of status
  python3 manage.py run_connection_engine --dry-run  # Show what would happen without writing

The engine extracts entities via spaCy NER, finds shared entity and
topic connections, auto-creates Person/Org nodes, and logs everything
to DailyLog via signals.
"""

from django.core.management.base import BaseCommand, CommandError

from apps.notebook.engine import run_engine
from apps.notebook.models import KnowledgeNode


class Command(BaseCommand):
    help = 'Run the connection engine to discover relationships between knowledge nodes.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--node',
            type=int,
            help='Process a single node by primary key.',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Process all nodes (default: inbox + active only).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview which nodes would be processed without running the engine.',
        )

    def handle(self, *args, **options):
        if options['node']:
            try:
                node = KnowledgeNode.objects.get(pk=options['node'])
            except KnowledgeNode.DoesNotExist:
                raise CommandError(f'KnowledgeNode with pk={options["node"]} not found.')
            nodes = [node]
        elif options['all']:
            nodes = list(KnowledgeNode.objects.all().order_by('-captured_at'))
        else:
            nodes = list(
                KnowledgeNode.objects
                .filter(status__in=['inbox', 'active'])
                .order_by('-captured_at')
            )

        if not nodes:
            self.stdout.write('No nodes to process.')
            return

        self.stdout.write(f'Processing {len(nodes)} node(s)...\n')

        if options['dry_run']:
            for node in nodes:
                self.stdout.write(f'  Would process: [{node.pk}] {node.display_title[:60]}')
            self.stdout.write(self.style.WARNING(f'\nDry run: {len(nodes)} node(s) would be processed.'))
            return

        totals = {
            'entities_extracted': 0,
            'edges_from_entities': 0,
            'edges_from_shared': 0,
            'edges_from_topics': 0,
            'nodes_auto_created': 0,
        }

        for node in nodes:
            self.stdout.write(f'\n  [{node.pk}] {node.display_title[:60]}')
            results = run_engine(node)

            for key in totals:
                totals[key] += results[key]

            if results['entities_extracted']:
                self.stdout.write(f'    Entities: {results["entities_extracted"]}')
            if results['edges_from_entities']:
                self.stdout.write(f'    Mention edges: {results["edges_from_entities"]}')
            if results['edges_from_shared']:
                self.stdout.write(f'    Shared entity edges: {results["edges_from_shared"]}')
            if results['edges_from_topics']:
                self.stdout.write(f'    Topic edges: {results["edges_from_topics"]}')
            if results['nodes_auto_created']:
                self.stdout.write(
                    self.style.SUCCESS(f'    Auto-created nodes: {results["nodes_auto_created"]}')
                )

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Totals across {len(nodes)} node(s):\n'
            f'  Entities extracted: {totals["entities_extracted"]}\n'
            f'  Mention edges: {totals["edges_from_entities"]}\n'
            f'  Shared entity edges: {totals["edges_from_shared"]}\n'
            f'  Topic edges: {totals["edges_from_topics"]}\n'
            f'  Auto-created nodes: {totals["nodes_auto_created"]}'
        ))
