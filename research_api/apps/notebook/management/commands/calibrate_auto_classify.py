from __future__ import annotations

import itertools
import json
from collections import Counter

from django.core.management.base import BaseCommand

from apps.notebook.auto_classify import DEFAULT_RULES, classify_object
from apps.notebook.models import Object


def _evaluate(objects, rules: dict):
    predicted_counts = Counter()
    mismatches = Counter()

    total = len(objects)
    matches = 0
    non_note_total = 0
    non_note_matches = 0

    for obj in objects:
        actual = obj.object_type.slug if obj.object_type else 'note'
        predicted = classify_object(obj, rules=rules)
        predicted_counts[predicted] += 1

        if predicted == actual:
            matches += 1
        else:
            mismatches[(actual, predicted)] += 1

        if actual != 'note':
            non_note_total += 1
            if predicted == actual:
                non_note_matches += 1

    overall_accuracy = matches / total if total else 0.0
    non_note_accuracy = non_note_matches / non_note_total if non_note_total else 0.0
    score = non_note_accuracy * 0.7 + overall_accuracy * 0.3

    return {
        'total': total,
        'matches': matches,
        'overall_accuracy': round(overall_accuracy, 4),
        'non_note_total': non_note_total,
        'non_note_matches': non_note_matches,
        'non_note_accuracy': round(non_note_accuracy, 4),
        'score': round(score, 4),
        'predicted_counts': dict(predicted_counts),
        'top_mismatches': [
            {'actual': actual, 'predicted': predicted, 'count': count}
            for (actual, predicted), count in mismatches.most_common(12)
        ],
    }


class Command(BaseCommand):
    help = 'Calibrate auto-classification thresholds against existing typed Objects.'

    def add_arguments(self, parser):
        parser.add_argument('--notebook', type=str, default='', help='Optional notebook slug scope.')
        parser.add_argument('--limit', type=int, default=1000, help='Max objects to evaluate.')
        parser.add_argument(
            '--include-note',
            action='store_true',
            help='Include note-typed objects in calibration set.',
        )
        parser.add_argument(
            '--json',
            type=str,
            default='',
            help='Optional file path to write calibration output JSON.',
        )

    def handle(self, *args, **options):
        notebook_slug = (options.get('notebook') or '').strip()
        limit = int(options.get('limit') or 0)
        include_note = bool(options.get('include_note'))
        json_path = (options.get('json') or '').strip()

        qs = (
            Object.objects
            .filter(is_deleted=False, object_type__isnull=False)
            .exclude(body='')
            .select_related('object_type', 'notebook')
            .order_by('-captured_at')
        )
        if notebook_slug:
            qs = qs.filter(notebook__slug=notebook_slug)
        if not include_note:
            qs = qs.exclude(object_type__slug='note')
        if limit > 0:
            qs = qs[:limit]

        objects = list(qs)
        if not objects:
            self.stdout.write('No objects found for calibration.')
            return

        baseline = _evaluate(objects, DEFAULT_RULES)

        grid = {
            'code_density_threshold': [0.15, 0.20, 0.25, 0.30],
            'question_density_threshold': [0.25, 0.30, 0.35, 0.40],
            'date_short_word_limit': [80, 100, 120],
            'citation_min_words': [120, 160, 200, 260],
            'quote_max_words': [35, 50, 70],
        }

        best_rules = dict(DEFAULT_RULES)
        best_metrics = baseline

        keys = list(grid.keys())
        for combo in itertools.product(*(grid[key] for key in keys)):
            candidate_rules = dict(DEFAULT_RULES)
            for key, value in zip(keys, combo):
                candidate_rules[key] = value

            metrics = _evaluate(objects, candidate_rules)
            if metrics['score'] > best_metrics['score']:
                best_metrics = metrics
                best_rules = candidate_rules

        output = {
            'scope': {
                'notebook': notebook_slug or None,
                'limit': limit,
                'include_note': include_note,
            },
            'baseline_rules': DEFAULT_RULES,
            'baseline_metrics': baseline,
            'best_rules': best_rules,
            'best_metrics': best_metrics,
            'improvement': round(best_metrics['score'] - baseline['score'], 4),
        }

        if json_path:
            with open(json_path, 'w', encoding='utf-8') as handle:
                json.dump(output, handle, indent=2)

        self.stdout.write(json.dumps(output, indent=2))
