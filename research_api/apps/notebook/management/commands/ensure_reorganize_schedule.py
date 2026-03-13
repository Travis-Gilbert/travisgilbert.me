from django.core.management.base import BaseCommand

from apps.notebook.scheduling import ensure_periodic_reorganize_schedule


class Command(BaseCommand):
    help = 'Ensure the nightly periodic_reorganize scheduler job exists.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Attempt scheduling even if ENABLE_SELF_ORGANIZE_SCHEDULER is not set.',
        )

    def handle(self, *args, **options):
        result = ensure_periodic_reorganize_schedule(force=bool(options.get('force')))
        self.stdout.write(str(result))
