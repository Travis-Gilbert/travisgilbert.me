"""
Seed built-in ComponentTypes for the CommonPlace knowledge graph.

Usage:
  python3 manage.py seed_component_types
"""

from django.core.management.base import BaseCommand

from apps.notebook.models import ComponentType


BUILT_IN_TYPES = [
    {
        'name': 'Text',
        'slug': 'text',
        'data_type': 'text',
        'triggers_node': False,
        'sort_order': 0,
    },
    {
        'name': 'Date',
        'slug': 'date',
        'data_type': 'date',
        'triggers_node': True,
        'sort_order': 1,
    },
    {
        'name': 'Recurring Date',
        'slug': 'recurring_date',
        'data_type': 'recurring_date',
        'triggers_node': True,
        'sort_order': 2,
    },
    {
        'name': 'Relationship',
        'slug': 'relationship',
        'data_type': 'relationship',
        'triggers_node': True,
        'sort_order': 3,
    },
    {
        'name': 'Location',
        'slug': 'location',
        'data_type': 'location',
        'triggers_node': False,
        'sort_order': 4,
    },
    {
        'name': 'File',
        'slug': 'file',
        'data_type': 'file',
        'triggers_node': False,
        'sort_order': 5,
    },
    {
        'name': 'URL',
        'slug': 'url',
        'data_type': 'url',
        'triggers_node': False,
        'sort_order': 6,
    },
    {
        'name': 'Status',
        'slug': 'status',
        'data_type': 'status',
        'triggers_node': True,
        'sort_order': 7,
    },
    {
        'name': 'Number',
        'slug': 'number',
        'data_type': 'number',
        'triggers_node': False,
        'sort_order': 8,
    },
    {
        'name': 'Tag',
        'slug': 'tag',
        'data_type': 'tag',
        'triggers_node': False,
        'sort_order': 9,
    },
    {
        'name': 'Code',
        'slug': 'code',
        'data_type': 'code',
        'triggers_node': False,
        'sort_order': 10,
    },
]


class Command(BaseCommand):
    help = 'Create or update the 11 built-in ComponentTypes for CommonPlace.'

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0

        for data in BUILT_IN_TYPES:
            slug = data.pop('slug')
            obj, created = ComponentType.objects.update_or_create(
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
