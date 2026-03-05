"""
Stub: replaced by seed_object_types.py.
This file preserved temporarily to avoid import errors.
"""

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Deprecated: use seed_object_types instead.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING(
            'This command is deprecated. Use seed_object_types instead.'
        ))
