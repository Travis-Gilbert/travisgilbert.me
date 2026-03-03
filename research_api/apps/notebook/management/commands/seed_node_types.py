"""
Seed built-in NodeTypes for the Notebooks knowledge graph.

Run: python3 manage.py seed_node_types

Creates the 10 default types with icons and brand colors matching
the SketchIcon system. Safe to run multiple times (uses get_or_create).
"""

from django.core.management.base import BaseCommand

from apps.notebook.models import NodeType


BUILT_IN_TYPES = [
    {
        'name': 'Note',
        'slug': 'note',
        'icon': 'note-pencil',
        'color': '#F5F0E8',
        'sort_order': 0,
        'schema': {},
    },
    {
        'name': 'Source',
        'slug': 'source',
        'icon': 'book-open',
        'color': '#2D5F6B',
        'sort_order': 1,
        'schema': {
            'fields': ['author', 'publication', 'date_published', 'source_type'],
        },
    },
    {
        'name': 'Person',
        'slug': 'person',
        'icon': 'note-pencil',
        'color': '#B45A2D',
        'sort_order': 2,
        'schema': {
            'fields': ['born', 'died', 'role', 'org'],
        },
    },
    {
        'name': 'Place',
        'slug': 'place',
        'icon': 'note-pencil',
        'color': '#C49A4A',
        'sort_order': 3,
        'schema': {
            'fields': ['latitude', 'longitude', 'region', 'country'],
        },
    },
    {
        'name': 'Organization',
        'slug': 'organization',
        'icon': 'note-pencil',
        'color': '#5A7A4A',
        'sort_order': 4,
        'schema': {
            'fields': ['founded', 'headquarters', 'industry'],
        },
    },
    {
        'name': 'Concept',
        'slug': 'concept',
        'icon': 'note-pencil',
        'color': '#7B5EA7',
        'sort_order': 5,
        'schema': {
            'fields': ['domain', 'related_concepts'],
        },
    },
    {
        'name': 'Event',
        'slug': 'event',
        'icon': 'note-pencil',
        'color': '#4A6FA5',
        'sort_order': 6,
        'schema': {
            'fields': ['date', 'location', 'participants'],
        },
    },
    {
        'name': 'Project',
        'slug': 'project',
        'icon': 'briefcase',
        'color': '#B45A2D',
        'sort_order': 7,
        'schema': {
            'fields': ['status', 'deadline', 'collaborators'],
        },
    },
    {
        'name': 'Hunch',
        'slug': 'hunch',
        'icon': 'note-pencil',
        'color': '#C77D8A',
        'sort_order': 8,
        'schema': {
            'fields': ['confidence', 'revisit_date'],
        },
    },
    {
        'name': 'Quote',
        'slug': 'quote',
        'icon': 'note-pencil',
        'color': '#D4A843',
        'sort_order': 9,
        'schema': {
            'fields': ['author', 'source', 'context'],
        },
    },
]


class Command(BaseCommand):
    help = 'Create built-in NodeTypes for the Notebooks knowledge graph.'

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for type_data in BUILT_IN_TYPES:
            slug = type_data.pop('slug')
            name = type_data.pop('name')

            obj, created = NodeType.objects.get_or_create(
                slug=slug,
                defaults={
                    'name': name,
                    'is_built_in': True,
                    **type_data,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'  Created: {obj.name}'))
            else:
                # Update existing built-in types with latest values
                changed = False
                for key, value in type_data.items():
                    if getattr(obj, key) != value:
                        setattr(obj, key, value)
                        changed = True
                if obj.name != name:
                    obj.name = name
                    changed = True
                if not obj.is_built_in:
                    obj.is_built_in = True
                    changed = True

                if changed:
                    obj.save()
                    updated_count += 1
                    self.stdout.write(f'  Updated: {obj.name}')
                else:
                    self.stdout.write(f'  Exists: {obj.name}')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. {created_count} created, {updated_count} updated, '
            f'{len(BUILT_IN_TYPES) - created_count - updated_count} unchanged.'
        ))
