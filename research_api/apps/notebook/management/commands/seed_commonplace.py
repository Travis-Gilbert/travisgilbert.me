"""
Combined seed command: ObjectTypes + ComponentTypes + master Timeline.

Usage:
  python3 manage.py seed_commonplace
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand

from apps.notebook.models import Timeline


class Command(BaseCommand):
    help = 'Seed all CommonPlace foundation data: ObjectTypes, ComponentTypes, master Timeline.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('Seeding ObjectTypes...'))
        call_command('seed_object_types', stdout=self.stdout, stderr=self.stderr)

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Seeding ComponentTypes...'))
        call_command('seed_component_types', stdout=self.stdout, stderr=self.stderr)

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Creating master Timeline...'))
        timeline, created = Timeline.objects.get_or_create(
            is_master=True,
            defaults={
                'name': 'Master Timeline',
                'slug': 'master',
            },
        )
        if created:
            self.stdout.write(f'  Created: {timeline.name}')
        else:
            self.stdout.write(f'  Already exists: {timeline.name}')

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            'CommonPlace foundation seeded successfully.'
        ))
