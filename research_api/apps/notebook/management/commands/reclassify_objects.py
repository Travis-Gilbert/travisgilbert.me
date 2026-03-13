from __future__ import annotations

import json
from collections import Counter

from django.core.management.base import BaseCommand

from apps.notebook.auto_classify import score_object_types
from apps.notebook.models import Object, ObjectType


def _best_vote(votes: dict[str, int]) -> tuple[str, int, int]:
    if not votes:
        return 'note', 0, 0

    ranked = sorted(votes.items(), key=lambda item: item[1], reverse=True)
    best_slug, best_score = ranked[0]
    second_score = ranked[1][1] if len(ranked) > 1 else 0
    margin = best_score - second_score
    return best_slug, int(best_score), int(margin)


class Command(BaseCommand):
    help = (
        'Backfill auto-classification for existing Objects. '
        'Defaults to untyped or note-typed objects only.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--notebook', type=str, default='', help='Optional notebook slug scope.')
        parser.add_argument('--limit', type=int, default=0, help='Optional max objects to inspect.')
        parser.add_argument(
            '--include-typed',
            action='store_true',
            help='Also inspect already typed objects (not only note/untyped).',
        )
        parser.add_argument(
            '--min-score',
            type=int,
            default=2,
            help='Minimum top vote score required to apply a reclassification.',
        )
        parser.add_argument(
            '--min-margin',
            type=int,
            default=1,
            help='Minimum vote margin over second-best type.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without persisting them.',
        )

    def handle(self, *args, **options):
        notebook_slug = (options.get('notebook') or '').strip()
        limit = int(options.get('limit') or 0)
        include_typed = bool(options.get('include_typed'))
        min_score = int(options.get('min_score') or 0)
        min_margin = int(options.get('min_margin') or 0)
        dry_run = bool(options.get('dry_run'))

        type_cache = {obj_type.slug: obj_type for obj_type in ObjectType.objects.all()}
        note_type = type_cache.get('note')

        objects_qs = (
            Object.objects
            .filter(is_deleted=False)
            .select_related('object_type', 'notebook')
            .order_by('-captured_at')
        )
        if notebook_slug:
            objects_qs = objects_qs.filter(notebook__slug=notebook_slug)
        if not include_typed:
            if note_type is not None:
                objects_qs = objects_qs.filter(object_type_id=note_type.id)
            else:
                objects_qs = objects_qs.filter(object_type__isnull=True)
        if limit > 0:
            objects_qs = objects_qs[:limit]

        inspected = 0
        changed = 0
        skipped_low_confidence = 0
        skipped_missing_type = 0
        by_transition = Counter()
        samples = []

        for obj in objects_qs:
            inspected += 1
            votes = score_object_types(obj)
            predicted_slug, best_score, margin = _best_vote(votes)
            predicted_type = type_cache.get(predicted_slug)

            current_slug = obj.object_type.slug if obj.object_type else 'untyped'
            if predicted_slug == current_slug:
                continue

            if best_score < min_score or margin < min_margin:
                skipped_low_confidence += 1
                continue

            if predicted_type is None:
                skipped_missing_type += 1
                continue

            by_transition[f'{current_slug}->{predicted_slug}'] += 1
            if len(samples) < 25:
                samples.append(
                    {
                        'object_id': obj.pk,
                        'title': obj.display_title,
                        'current': current_slug,
                        'predicted': predicted_slug,
                        'top_score': best_score,
                        'margin': margin,
                    },
                )

            if not dry_run:
                obj.object_type = predicted_type
                obj.save(update_fields=['object_type', 'updated_at'])
            changed += 1

        payload = {
            'scope': {
                'notebook': notebook_slug or None,
                'include_typed': include_typed,
                'limit': limit or None,
                'dry_run': dry_run,
                'min_score': min_score,
                'min_margin': min_margin,
            },
            'inspected': inspected,
            'changed': changed,
            'skipped_low_confidence': skipped_low_confidence,
            'skipped_missing_type': skipped_missing_type,
            'transitions': dict(by_transition),
            'samples': samples,
        }
        self.stdout.write(json.dumps(payload, indent=2))
