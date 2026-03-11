from django.core.management.base import BaseCommand, CommandError

from apps.notebook.community import detect_communities, persist_communities


class Command(BaseCommand):
    help = 'Run Louvain community detection on the notebook knowledge graph.'

    def add_arguments(self, parser):
        parser.add_argument('--notebook', type=str, default='')
        parser.add_argument('--resolution', type=float, default=1.0)
        parser.add_argument('--persist', action='store_true')

    def handle(self, *args, **options):
        from apps.notebook.models import Notebook

        notebook = None
        notebook_slug = (options.get('notebook') or '').strip()
        if notebook_slug:
            notebook = Notebook.objects.filter(slug=notebook_slug).first()
            if notebook is None:
                raise CommandError(f'Notebook "{notebook_slug}" not found.')

        result = detect_communities(
            notebook=notebook,
            resolution=options['resolution'],
        )

        self.stdout.write(
            'Found '
            f"{result['n_communities']} communities "
            f"(modularity: {result['modularity']:.4f}) "
            f"across {result['n_nodes']} nodes and {result['n_edges']} edges"
        )
        for community in result['communities']:
            self.stdout.write(f"  {community['label']}: {community['size']} members")

        if options['persist']:
            persist_communities(result, notebook=notebook)
            self.stdout.write(self.style.SUCCESS('Communities persisted.'))
