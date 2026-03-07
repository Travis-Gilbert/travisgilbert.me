"""
Management command: explore advanced NLP features on real source data.

Run from the research_api directory:

    python manage.py explore_nlp --status
    python manage.py explore_nlp --tensions
    python manage.py explore_nlp --similar <source-slug>
    python manage.py explore_nlp --compare <slug-a> <slug-b>
    python manage.py explore_nlp --upgrade-test

This command is for experimentation only. It prints results to the
console. Once you find patterns that are valuable, they get built
into the API endpoints.
"""

from django.core.management.base import BaseCommand, CommandError

from apps.research.models import Source, SourceLink


class Command(BaseCommand):
    help = 'Explore advanced NLP features (PyTorch) on real source data.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--status',
            action='store_true',
            help='Show which NLP models are available.',
        )
        parser.add_argument(
            '--tensions',
            action='store_true',
            help='Scan all source pairs for contradictions using NLI.',
        )
        parser.add_argument(
            '--similar',
            type=str,
            metavar='SLUG',
            help='Find sources semantically similar to the given source.',
        )
        parser.add_argument(
            '--compare',
            nargs=2,
            type=str,
            metavar=('SLUG_A', 'SLUG_B'),
            help='Full analysis of two sources: similarity + NLI.',
        )
        parser.add_argument(
            '--upgrade-test',
            action='store_true',
            help='Compare spaCy vs sentence-transformer similarity for all source pairs.',
        )
        parser.add_argument(
            '--top',
            type=int,
            default=10,
            help='Number of results to show (default 10).',
        )
        parser.add_argument(
            '--threshold',
            type=float,
            default=0.5,
            help='Minimum score threshold (default 0.5).',
        )

    def handle(self, **options):
        from apps.research.advanced_nlp import (
            HAS_PYTORCH,
            analyze_pair,
            detect_contradictions,
            find_most_similar,
            get_nlp_status,
            sentence_similarity,
        )

        if options['status']:
            self._show_status(get_nlp_status)
            return

        if not HAS_PYTORCH:
            self.stderr.write(self.style.ERROR(
                'PyTorch is not installed. Install with:\n'
                '  pip install torch --extra-index-url '
                'https://download.pytorch.org/whl/cpu --break-system-packages\n'
                '  pip install sentence-transformers --break-system-packages'
            ))
            return

        if options['tensions']:
            self._find_tensions(detect_contradictions, options['threshold'], options['top'])
        elif options['similar']:
            self._find_similar(options['similar'], find_most_similar, options['top'], options['threshold'])
        elif options['compare']:
            self._compare_sources(options['compare'][0], options['compare'][1], analyze_pair)
        elif options['upgrade_test']:
            self._upgrade_comparison(sentence_similarity)
        else:
            self.stderr.write('Specify one of: --status, --tensions, --similar, --compare, --upgrade-test')

    def _show_status(self, get_nlp_status):
        status = get_nlp_status()
        self.stdout.write('\n  NLP Capabilities\n')
        self.stdout.write(f"  PyTorch:          {'YES' if status['pytorch_available'] else 'NO'}")
        self.stdout.write(f"  Sentence model:   {status['sentence_model'] or 'Not loaded'}")
        self.stdout.write(f"  NLI model:        {status['nli_model'] or 'Not loaded'}")
        self.stdout.write(f"  spaCy model:      {status['spacy_model'] or 'Not loaded'}")
        self.stdout.write('')

        source_count = Source.objects.public().count()
        link_count = SourceLink.objects.count()
        sources_with_text = Source.objects.public().exclude(public_annotation='').count()
        self.stdout.write(f'  Sources:          {source_count} ({sources_with_text} with annotations)')
        self.stdout.write(f'  Source links:     {link_count}')
        self.stdout.write('')

    def _find_tensions(self, detect_contradictions, threshold, top_n):
        """Scan source pairs that share content for contradictions."""
        self.stdout.write('\n  Scanning for contradictions...\n')

        links = SourceLink.objects.select_related('source').filter(source__public=True)

        from collections import defaultdict
        content_sources = defaultdict(list)
        for link in links:
            key = f"{link.content_type}:{link.content_slug}"
            src = link.source
            if src.public_annotation:
                content_sources[key].append(src)

        seen_pairs = set()
        pairs = []
        pair_metadata = []

        for content_key, sources in content_sources.items():
            for i in range(len(sources)):
                for j in range(i + 1, len(sources)):
                    pair_key = tuple(sorted([sources[i].slug, sources[j].slug]))
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)
                    pairs.append((
                        sources[i].public_annotation,
                        sources[j].public_annotation,
                    ))
                    pair_metadata.append((sources[i], sources[j], content_key))

        self.stdout.write(f'  Found {len(pairs)} source pairs sharing content.\n')

        if not pairs:
            self.stdout.write('  No pairs with annotations to compare.')
            return

        contradictions = detect_contradictions(pairs, threshold=threshold)

        if not contradictions:
            self.stdout.write(f'  No contradictions found above threshold {threshold}.')
            return

        self.stdout.write(
            self.style.SUCCESS(f'  Found {len(contradictions)} contradiction(s):\n')
        )

        for c in contradictions[:top_n]:
            for (text_a, text_b), (src_a, src_b, content) in zip(pairs, pair_metadata):
                if text_a == c['text_a'] and text_b == c['text_b']:
                    self.stdout.write(f"  TENSION (score: {c['contradiction_score']:.2f})")
                    self.stdout.write(f"    Source A: {src_a.title}")
                    self.stdout.write(f"      \"{src_a.public_annotation[:120]}...\"")
                    self.stdout.write(f"    Source B: {src_b.title}")
                    self.stdout.write(f"      \"{src_b.public_annotation[:120]}...\"")
                    self.stdout.write(f"    Shared content: {content}")
                    self.stdout.write('')
                    break

    def _find_similar(self, slug, find_most_similar, top_n, threshold):
        """Find sources similar to the given source using sentence embeddings."""
        try:
            target = Source.objects.public().get(slug=slug)
        except Source.DoesNotExist:
            raise CommandError(f'Source "{slug}" not found.')

        from apps.research.embeddings import build_content_text

        target_text = build_content_text(
            title=target.title,
            annotation=target.public_annotation,
            tags=target.tags,
            creator=target.creator,
        )

        others = Source.objects.public().exclude(pk=target.pk)
        candidate_texts = []
        candidate_ids = []

        for src in others:
            text = build_content_text(
                title=src.title,
                annotation=src.public_annotation,
                tags=src.tags,
                creator=src.creator,
            )
            candidate_texts.append(text)
            candidate_ids.append(src.slug)

        self.stdout.write(f'\n  Similar to: {target.title}\n')

        results = find_most_similar(
            target_text, candidate_texts, candidate_ids,
            top_n=top_n, threshold=threshold,
        )

        if not results:
            self.stdout.write(f'  No sources found above threshold {threshold}.')
            return

        for r in results:
            src = Source.objects.get(slug=r['id'])
            self.stdout.write(f"    {r['similarity']:.3f}  {src.title}")
            if src.creator:
                self.stdout.write(f"           by {src.creator}")

        self.stdout.write('')

    def _compare_sources(self, slug_a, slug_b, analyze_pair):
        """Full analysis of two specific sources."""
        try:
            src_a = Source.objects.public().get(slug=slug_a)
        except Source.DoesNotExist:
            raise CommandError(f'Source "{slug_a}" not found.')

        try:
            src_b = Source.objects.public().get(slug=slug_b)
        except Source.DoesNotExist:
            raise CommandError(f'Source "{slug_b}" not found.')

        text_a = src_a.public_annotation or src_a.title
        text_b = src_b.public_annotation or src_b.title

        self.stdout.write(f'\n  Comparing:\n')
        self.stdout.write(f'    A: {src_a.title}')
        self.stdout.write(f'       "{text_a[:150]}"')
        self.stdout.write(f'    B: {src_b.title}')
        self.stdout.write(f'       "{text_b[:150]}"')
        self.stdout.write('')

        result = analyze_pair(text_a, text_b)

        if result['similarity'] is not None:
            self.stdout.write(f"  Similarity:     {result['similarity']:.3f}")
        if result['relationship']:
            r = result['relationship']
            self.stdout.write(f"  Relationship:   {r['label']} (confidence: {r['confidence']:.2f})")
            self.stdout.write(f"    Contradiction: {r['scores']['contradiction']:.3f}")
            self.stdout.write(f"    Entailment:    {r['scores']['entailment']:.3f}")
            self.stdout.write(f"    Neutral:       {r['scores']['neutral']:.3f}")
        self.stdout.write(f"  Tension signal: {result['tension_signal']:.3f}")
        self.stdout.write(f"\n  {result['interpretation']}\n")

    def _upgrade_comparison(self, sentence_similarity):
        """Compare spaCy similarity vs sentence-transformer similarity."""
        from apps.research.embeddings import (
            build_content_text,
            cosine_similarity as spacy_cosine,
            get_document_vector,
        )

        sources = list(
            Source.objects.public()
            .exclude(public_annotation='')
            .order_by('-created_at')[:20]
        )

        if len(sources) < 2:
            self.stdout.write('  Not enough sources with annotations to compare.')
            return

        self.stdout.write(f'\n  Comparing spaCy vs sentence-transformer on {len(sources)} sources...\n')
        self.stdout.write(f'  {"Pair":<60} {"spaCy":>8} {"ST":>8} {"Diff":>8}')
        self.stdout.write(f'  {"":<60} {"":>8} {"":>8} {"":>8}')

        differences = []

        for i in range(len(sources)):
            for j in range(i + 1, len(sources)):
                text_a = build_content_text(
                    title=sources[i].title,
                    annotation=sources[i].public_annotation,
                    tags=sources[i].tags,
                )
                text_b = build_content_text(
                    title=sources[j].title,
                    annotation=sources[j].public_annotation,
                    tags=sources[j].tags,
                )

                vec_a = get_document_vector(text_a)
                vec_b = get_document_vector(text_b)
                spacy_sim = spacy_cosine(vec_a, vec_b)

                st_sim = sentence_similarity(text_a, text_b)
                if st_sim is None:
                    continue

                diff = abs(st_sim - spacy_sim)
                pair_label = f"{sources[i].title[:28]} / {sources[j].title[:28]}"

                differences.append((pair_label, spacy_sim, st_sim, diff))

        differences.sort(key=lambda d: d[3], reverse=True)

        for label, spacy_sim, st_sim, diff in differences[:20]:
            marker = ' ***' if diff > 0.2 else ''
            self.stdout.write(
                f'  {label:<60} {spacy_sim:>8.3f} {st_sim:>8.3f} {diff:>8.3f}{marker}'
            )

        self.stdout.write('')
        self.stdout.write('  *** = pairs where the models disagree significantly')
        self.stdout.write('  These are the cases where sentence-transformers adds the most value.')
        self.stdout.write('')
