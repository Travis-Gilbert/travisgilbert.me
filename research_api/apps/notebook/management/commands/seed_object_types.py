"""
Seed built-in ObjectTypes for the CommonPlace knowledge graph.

Usage:
  python3 manage.py seed_object_types
"""

from django.core.management.base import BaseCommand

from apps.notebook.models import ObjectType


BUILT_IN_TYPES = [
    {
        'name': 'Note',
        'slug': 'note',
        'icon': 'note-pencil',
        'color': '#F2EDE5',
        'default_components': ['body'],
        'sort_order': 0,
    },
    {
        'name': 'Source',
        'slug': 'source',
        'icon': 'book-open',
        'color': '#2D5F6B',
        'default_components': ['url', 'author', 'publication', 'date', 'history'],
        'sort_order': 1,
    },
    {
        'name': 'Person',
        'slug': 'person',
        'icon': 'person',
        'color': '#B45A2D',
        'default_components': ['birthday', 'death_date', 'relations', 'history'],
        'sort_order': 2,
    },
    {
        'name': 'Place',
        'slug': 'place',
        'icon': 'map-pin',
        'color': '#C49A4A',
        'default_components': ['location', 'coordinates', 'history'],
        'sort_order': 3,
    },
    {
        'name': 'Organization',
        'slug': 'organization',
        'icon': 'building',
        'color': '#5A7A4A',
        'default_components': ['hq_location', 'founding_date', 'history'],
        'sort_order': 4,
    },
    {
        'name': 'Concept',
        'slug': 'concept',
        'icon': 'lightbulb',
        'color': '#7B5EA7',
        'default_components': ['definition', 'related_concepts'],
        'sort_order': 5,
    },
    {
        'name': 'Quote',
        'slug': 'quote',
        'icon': 'quote',
        'color': '#D4A843',
        'default_components': ['source_ref', 'speaker', 'context'],
        'sort_order': 6,
    },
    {
        'name': 'Hunch',
        'slug': 'hunch',
        'icon': 'sparkle',
        'color': '#C77D8A',
        'default_components': ['body', 'confidence'],
        'sort_order': 7,
    },
    {
        'name': 'Event',
        'slug': 'event',
        'icon': 'calendar',
        'color': '#4A6A8A',
        'default_components': ['date', 'location', 'history'],
        'sort_order': 8,
    },
    {
        'name': 'Script',
        'slug': 'script',
        'icon': 'code',
        'color': '#6A7A8A',
        'default_components': ['language', 'file', 'version'],
        'sort_order': 9,
    },
    {
        'name': 'Task',
        'slug': 'task',
        'icon': 'check-circle',
        'color': '#C46A3A',
        'default_components': ['status', 'due_date', 'assignee', 'history'],
        'sort_order': 10,
    },
]


class Command(BaseCommand):
    help = 'Create or update the 11 built-in ObjectTypes for CommonPlace.'

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for data in BUILT_IN_TYPES:
            slug = data.pop('slug')
            obj, created = ObjectType.objects.update_or_create(
                slug=slug,
                defaults={**data, 'is_built_in': True},
            )
            if created:
                created_count += 1
                self.stdout.write(f'  Created: {obj.name}')
            else:
                updated_count += 1
                self.stdout.write(f'  Updated: {obj.name}')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {created_count} created, {updated_count} updated.'
        ))
