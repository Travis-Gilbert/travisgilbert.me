"""
Management command: export_kge_triples

Exports Edge triples from the notebook graph into TSV format for offline
KGE (Knowledge Graph Embedding) training with PyKEEN.

Output files (written to kge_embeddings/ by default):
  - triples.tsv : (head_sha, relation, tail_sha) -- one triple per line
  - temporal_triples.tsv : (head_sha, relation, tail_sha, time_bucket, weight)
  - entity_map.tsv : (sha_hash, display_title, object_type) -- entity metadata
  - relation_map.tsv : (edge_type, description) -- relation metadata

After exporting, run:
  python scripts/train_kge.py

Then embeddings are available at:
  kge_embeddings/entity_embeddings.npy
  kge_embeddings/entity_to_idx.json
  kge_embeddings/training_metadata.json

Usage:
  python manage.py export_kge_triples
  python manage.py export_kge_triples --output-dir /path/to/kge_embeddings
  python manage.py export_kge_triples --include-object-types
"""

import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone


RELATION_DESCRIPTIONS = {
    'mentions': 'One object directly references or discusses this entity',
    'shared_entity': 'Both objects mention the same named entity',
    'shared_topic': 'Both objects discuss overlapping themes or vocabulary',
    'semantic': 'Objects are semantically similar in meaning',
    'contradicts': 'Objects appear to make conflicting claims',
    'supports': 'Objects reinforce or entail each other',
    'related': 'User-defined or component-driven relationship',
    'manual': 'User-created explicit connection',
}


class Command(BaseCommand):
    help = (
        'Export notebook Edge triples to TSV for offline KGE training. '
        'Run scripts/train_kge.py after export to produce embeddings.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--output-dir',
            type=str,
            default='kge_embeddings',
            help='Directory to write TSV files (created if it does not exist).',
        )
        parser.add_argument(
            '--include-object-types',
            action='store_true',
            default=True,
            help='Add (object, has_type, object_type) triples to enrich the graph.',
        )
        parser.add_argument(
            '--min-strength',
            type=float,
            default=0.0,
            help='Only export edges with strength >= this value (0.0 = all edges).',
        )

    def handle(self, *args, **options):
        from apps.notebook.models import Edge, Object, ObjectType

        output_dir = Path(options['output_dir'])
        output_dir.mkdir(parents=True, exist_ok=True)

        include_types = options['include_object_types']
        min_strength = options['min_strength']

        self.stdout.write(f'Exporting KGE triples to {output_dir}...')

        # Collect all Edges
        edges = Edge.objects.filter(
            from_object__is_deleted=False,
            to_object__is_deleted=False,
            strength__gte=min_strength,
        ).select_related('from_object', 'to_object')

        triples = []
        temporal_triples = []
        entity_shas = set()
        relations_seen = set()

        for edge in edges:
            head = edge.from_object.sha_hash
            tail = edge.to_object.sha_hash
            rel = edge.edge_type
            timestamp = timezone.localtime(edge.created_at)
            iso = timestamp.isocalendar()
            time_bucket = f'{iso.year}-W{iso.week:02d}'
            weight = round(float(edge.strength or 0.0), 4)

            triples.append((head, rel, tail))
            temporal_triples.append((head, rel, tail, time_bucket, weight))
            entity_shas.add(edge.from_object.sha_hash)
            entity_shas.add(edge.to_object.sha_hash)
            relations_seen.add(rel)

        # Add object-type triples
        if include_types:
            objects_with_types = (
                Object.objects
                .filter(is_deleted=False, object_type__isnull=False)
                .select_related('object_type')
            )
            for obj in objects_with_types:
                head = obj.sha_hash
                rel = 'has_type'
                tail = f'TYPE:{obj.object_type.slug}'
                triples.append((head, rel, tail))
                entity_shas.add(head)
                entity_shas.add(tail)
                relations_seen.add(rel)

        # Write triples.tsv
        triples_path = output_dir / 'triples.tsv'
        with open(triples_path, 'w') as f:
            f.write('head\trelation\ttail\n')
            for head, rel, tail in triples:
                f.write(f'{head}\t{rel}\t{tail}\n')

        self.stdout.write(f'  Wrote {len(triples)} triples to {triples_path}')

        temporal_path = output_dir / 'temporal_triples.tsv'
        with open(temporal_path, 'w') as f:
            f.write('head\trelation\ttail\ttime_bucket\tweight\n')
            for head, rel, tail, time_bucket, weight in temporal_triples:
                f.write(f'{head}\t{rel}\t{tail}\t{time_bucket}\t{weight}\n')

        self.stdout.write(
            f'  Wrote {len(temporal_triples)} temporal triples to {temporal_path}',
        )

        # Write entity_map.tsv
        sha_to_obj = {
            obj.sha_hash: obj
            for obj in Object.objects.filter(
                sha_hash__in=[s for s in entity_shas if not s.startswith('TYPE:')],
                is_deleted=False,
            ).select_related('object_type')
        }

        entity_path = output_dir / 'entity_map.tsv'
        with open(entity_path, 'w') as f:
            f.write('sha_hash\ttitle\tobject_type\n')
            for sha in entity_shas:
                if sha.startswith('TYPE:'):
                    f.write(f'{sha}\t{sha}\tObjectType\n')
                else:
                    obj = sha_to_obj.get(sha)
                    if obj:
                        title = (obj.display_title or '').replace('\t', ' ')[:100]
                        otype = obj.object_type.slug if obj.object_type else 'unknown'
                        f.write(f'{sha}\t{title}\t{otype}\n')

        self.stdout.write(f'  Wrote {len(entity_shas)} entities to {entity_path}')

        # Write relation_map.tsv
        relation_path = output_dir / 'relation_map.tsv'
        with open(relation_path, 'w') as f:
            f.write('relation\tdescription\n')
            for rel in sorted(relations_seen):
                desc = RELATION_DESCRIPTIONS.get(rel, rel)
                f.write(f'{rel}\t{desc}\n')

        # Write metadata.json
        metadata = {
            'triple_count': len(triples),
            'temporal_triple_count': len(temporal_triples),
            'entity_count': len(entity_shas),
            'relation_count': len(relations_seen),
            'time_bucket_count': len({row[3] for row in temporal_triples}),
            'relations': sorted(relations_seen),
            'min_strength_filter': min_strength,
            'include_object_types': include_types,
        }
        meta_path = output_dir / 'export_metadata.json'
        with open(meta_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        self.stdout.write(
            self.style.SUCCESS(
                f'\nExport complete.\n'
                f'  Triples   : {len(triples)}\n'
                f'  Entities  : {len(entity_shas)}\n'
                f'  Relations : {len(relations_seen)}\n'
                f'\nNext step:\n'
                f'  python scripts/train_kge.py --input-dir {output_dir}'
            )
        )
