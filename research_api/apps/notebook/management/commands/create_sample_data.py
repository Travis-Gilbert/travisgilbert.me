"""
Create sample data for testing the CommonPlace knowledge graph.

Creates 2 Notebooks, 1 Project each, ~15 Objects with Components,
and verifies Nodes auto-appear via signals.

Usage:
  python3 manage.py create_sample_data
  python3 manage.py create_sample_data --clean   # Delete all first
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.notebook.models import (
    Component,
    ComponentType,
    Edge,
    Notebook,
    Object,
    ObjectType,
    Project,
    Timeline,
)


class Command(BaseCommand):
    help = 'Create sample Objects, Components, Notebooks, and Projects for testing.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clean',
            action='store_true',
            help='Delete all existing sample data before creating.',
        )

    def handle(self, *args, **options):
        if options['clean']:
            self._clean()

        self.stdout.write(self.style.MIGRATE_HEADING('Creating Notebooks...'))
        nb_creative = self._get_or_create_notebook(
            'Creative Research', 'creative-research', '#2D5F6B',
            description='Research threads, hunches, and sources for creative projects.',
        )
        nb_work = self._get_or_create_notebook(
            'Work Tasks', 'work-tasks', '#D47B2D',
            description='Active work projects and tasks.',
        )

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Creating Projects...'))
        proj_essay = self._get_or_create_project(
            'Essay: The Shape of Tools', 'essay-shape-of-tools',
            nb_creative, mode='knowledge',
        )
        proj_sprint = self._get_or_create_project(
            'Q1 Sprint', 'q1-sprint',
            nb_work, mode='manage',
        )

        # Load ObjectTypes and ComponentTypes
        types = {ot.slug: ot for ot in ObjectType.objects.all()}
        ctypes = {ct.slug: ct for ct in ComponentType.objects.all()}

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Creating Objects...'))

        # --- Creative Research notebook ---

        note1 = self._create_object(
            'Tools shape thought before thought shapes tools',
            types['note'], nb_creative, proj_essay,
            body='McLuhan argued that media are extensions of ourselves. '
                 'But what happens when the tool precedes the intention? '
                 'A notebook invites certain kinds of thinking.',
        )

        source1 = self._create_object(
            'Understanding Media: Extensions of Man',
            types['source'], nb_creative, proj_essay,
            body='Marshall McLuhan, 1964. The medium is the message.',
            url='https://en.wikipedia.org/wiki/Understanding_Media',
        )
        self._add_component(source1, ctypes['text'], 'author', 'Marshall McLuhan')
        self._add_component(source1, ctypes['date'], 'publication_date', '1964-01-01')
        self._add_component(source1, ctypes['text'], 'publication', 'McGraw-Hill')

        source2 = self._create_object(
            'The Design of Everyday Things',
            types['source'], nb_creative, proj_essay,
            body='Don Norman on affordances and design.',
            url='https://en.wikipedia.org/wiki/The_Design_of_Everyday_Things',
        )
        self._add_component(source2, ctypes['text'], 'author', 'Don Norman')
        self._add_component(source2, ctypes['date'], 'publication_date', '1988-01-01')

        person1 = self._create_object(
            'Marshall McLuhan',
            types['person'], nb_creative, proj_essay,
            body='Canadian philosopher and media theorist.',
        )
        self._add_component(person1, ctypes['date'], 'birthday', '1911-07-21')
        self._add_component(person1, ctypes['date'], 'death_date', '1980-12-31')

        person2 = self._create_object(
            'Don Norman',
            types['person'], nb_creative, proj_essay,
            body='Director of the Design Lab at UC San Diego. Cognitive scientist.',
        )
        self._add_component(person2, ctypes['date'], 'birthday', '1935-12-25')

        concept1 = self._create_object(
            'Affordance',
            types['concept'], nb_creative, proj_essay,
            body='The qualities of an object that suggest how it might be used. '
                 'A door handle affords pulling; a flat plate affords pushing.',
        )
        self._add_component(concept1, ctypes['text'], 'definition',
                            'Properties of an object that indicate possibilities for action.')

        concept2 = self._create_object(
            'Medium is the Message',
            types['concept'], nb_creative, proj_essay,
            body='McLuhan\'s thesis that the form of a medium embeds itself in the message, '
                 'creating a symbiotic relationship by which the medium influences '
                 'how the message is perceived.',
        )

        hunch1 = self._create_object(
            'Notebooks as cognitive scaffolding',
            types['hunch'], nb_creative, proj_essay,
            body='The physical notebook is not just storage; it is a thinking partner. '
                 'The act of writing by hand engages spatial memory and forces '
                 'linearization of non-linear thought.',
        )
        self._add_component(hunch1, ctypes['number'], 'confidence', 0.7)

        quote1 = self._create_object(
            'We shape our tools and thereafter our tools shape us',
            types['quote'], nb_creative, proj_essay,
            body='Often attributed to McLuhan but actually from John Culkin, 1967.',
        )
        self._add_component(quote1, ctypes['text'], 'speaker', 'John Culkin')
        self._add_component(quote1, ctypes['text'], 'context', 'A Schoolman\'s Guide to Marshall McLuhan, 1967')

        place1 = self._create_object(
            'Centre for Culture and Technology',
            types['place'], nb_creative, proj_essay,
            body='McLuhan\'s research center at the University of Toronto.',
        )
        self._add_component(place1, ctypes['location'], 'location', 'Toronto, Canada')

        # --- Work Tasks notebook ---

        task1 = self._create_object(
            'Set up CommonPlace API endpoints',
            types['task'], nb_work, proj_sprint,
            body='Build DRF ViewSets for Object, Node, Component, Edge.',
        )
        self._add_component(task1, ctypes['status'], 'status', 'active')
        self._add_component(task1, ctypes['date'], 'due_date', '2026-03-15')

        task2 = self._create_object(
            'Write connection engine tests',
            types['task'], nb_work, proj_sprint,
            body='Unit tests for entity extraction, shared entity edges, topic similarity.',
        )
        self._add_component(task2, ctypes['status'], 'status', 'active')
        self._add_component(task2, ctypes['date'], 'due_date', '2026-03-20')

        script1 = self._create_object(
            'spaCy entity extraction pipeline',
            types['script'], nb_work, proj_sprint,
            body='Three-pass pipeline: NER extraction, shared entity matching, topic similarity.',
        )
        self._add_component(script1, ctypes['text'], 'language', 'Python')
        self._add_component(script1, ctypes['text'], 'version', '1.0')

        note2 = self._create_object(
            'Connection engine performance notes',
            types['note'], nb_work, proj_sprint,
            body='At 50 objects, spaCy NER runs in under 2 seconds. '
                 'Topic similarity (Jaccard) is O(n^2) but with max_candidates=500 '
                 'it stays under 10 seconds for realistic workloads.',
        )

        # --- Manual edges ---
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('Creating manual Edges...'))

        self._create_edge(source1, person1, 'authored_by', 'McLuhan wrote Understanding Media')
        self._create_edge(source2, person2, 'authored_by', 'Norman wrote Design of Everyday Things')
        self._create_edge(concept1, source2, 'derived_from', 'Affordance concept from Norman\'s work')
        self._create_edge(concept2, source1, 'derived_from', 'Medium is the Message from Understanding Media')
        self._create_edge(concept2, person1, 'attributed_to', 'McLuhan\'s central thesis')
        self._create_edge(note1, concept1, 'references', 'Note references affordance theory')
        self._create_edge(note1, concept2, 'references', 'Note references medium is the message')
        self._create_edge(hunch1, note1, 'supports', 'Hunch supports the tools-shape-thought observation')
        self._create_edge(quote1, person1, 'attributed_to', 'Quote often attributed to McLuhan')
        self._create_edge(place1, person1, 'associated_with', 'McLuhan\'s research center')

        # --- Summary ---
        self.stdout.write('')
        obj_count = Object.objects.count()
        comp_count = Component.objects.count()
        edge_count = Edge.objects.count()
        from apps.notebook.models import Node
        node_count = Node.objects.count()

        self.stdout.write(self.style.SUCCESS(
            f'Sample data created: {obj_count} Objects, {comp_count} Components, '
            f'{edge_count} Edges, {node_count} Nodes (auto-created by signals).'
        ))

    # --- Helpers ---

    def _clean(self):
        self.stdout.write(self.style.WARNING('Cleaning existing data...'))
        from apps.notebook.models import DailyLog, Layout, Node
        Edge.objects.all().delete()
        Component.objects.all().delete()
        Node.objects.all().delete()
        Object.objects.all().delete()
        Project.objects.all().delete()
        Notebook.objects.filter(slug__in=['creative-research', 'work-tasks']).delete()
        DailyLog.objects.all().delete()
        self.stdout.write('  Cleaned.')

    def _get_or_create_notebook(self, name, slug, color, **kwargs):
        nb, created = Notebook.objects.get_or_create(
            slug=slug,
            defaults={'name': name, 'color': color, **kwargs},
        )
        label = 'Created' if created else 'Exists'
        self.stdout.write(f'  {label}: {nb.name}')
        return nb

    def _get_or_create_project(self, name, slug, notebook, mode='knowledge'):
        proj, created = Project.objects.get_or_create(
            slug=slug,
            defaults={'name': name, 'notebook': notebook, 'mode': mode},
        )
        label = 'Created' if created else 'Exists'
        self.stdout.write(f'  {label}: {proj.name} ({mode})')
        return proj

    def _create_object(self, title, object_type, notebook, project, body='', url=''):
        obj, created = Object.objects.get_or_create(
            slug=self._slugify(title),
            defaults={
                'title': title,
                'object_type': object_type,
                'notebook': notebook,
                'project': project,
                'body': body,
                'url': url,
                'status': 'active',
            },
        )
        label = 'Created' if created else 'Exists'
        icon = object_type.icon if object_type else ''
        self.stdout.write(f'  {label}: [{icon}] {obj.title[:50]}')
        return obj

    def _add_component(self, obj, ctype, key, value):
        comp, created = Component.objects.get_or_create(
            object=obj,
            component_type=ctype,
            key=key,
            defaults={'value': value},
        )
        if created:
            self.stdout.write(f'    + {key}: {str(value)[:40]}')

    def _create_edge(self, from_obj, to_obj, edge_type, reason):
        edge, created = Edge.objects.get_or_create(
            from_object=from_obj,
            to_object=to_obj,
            edge_type=edge_type,
            defaults={
                'reason': reason,
                'strength': 0.8,
                'is_auto': False,
                'engine': 'manual',
            },
        )
        if created:
            self.stdout.write(
                f'  {from_obj.title[:25]} --[{edge_type}]--> {to_obj.title[:25]}'
            )

    @staticmethod
    def _slugify(text):
        import re
        slug = text.lower().strip()
        slug = re.sub(r'[^\w\s-]', '', slug)
        slug = re.sub(r'[-\s]+', '-', slug)
        return slug[:80]
