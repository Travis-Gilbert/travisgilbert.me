from django.core.management.base import BaseCommand

from apps.notebook.self_organize import periodic_reorganize


class Command(BaseCommand):
    help = 'Run periodic self-organization loops over the full graph.'

    def handle(self, *args, **options):
        results = periodic_reorganize()
        self.stdout.write(
            'Reorganization complete:\n'
            f'  Notebooks created: {results["notebooks_created"]}\n'
            f'  Entities promoted: {results["entities_promoted"]}\n'
            f'  Edges updated: {results["edges_updated"]}\n'
            f'  Edges pruned: {results["edges_pruned"]}\n'
            f'  Type suggestions: {results["type_suggestions"]}'
        )
