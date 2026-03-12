from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.notebook.models import Notebook
from apps.notebook.report import (
    generate_organization_report,
    render_organization_report_markdown,
)


class Command(BaseCommand):
    help = 'Export organization report as JSON or Markdown.'

    def add_arguments(self, parser):
        parser.add_argument('--notebook', type=str, default='', help='Optional notebook slug scope.')
        parser.add_argument(
            '--format',
            type=str,
            choices=['json', 'markdown'],
            default='json',
            help='Output format.',
        )
        parser.add_argument(
            '--output',
            type=str,
            default='',
            help='Optional file path. Defaults to stdout.',
        )
        parser.add_argument(
            '--timeline-limit',
            type=int,
            default=50,
            help='Max timeline events in report payload.',
        )

    def handle(self, *args, **options):
        notebook_slug = (options.get('notebook') or '').strip()
        fmt = (options.get('format') or 'json').strip().lower()
        output_path = (options.get('output') or '').strip()
        timeline_limit = int(options.get('timeline_limit') or 50)

        notebook = None
        if notebook_slug:
            notebook = Notebook.objects.filter(slug=notebook_slug).first()
            if notebook is None:
                self.stderr.write(f'Notebook "{notebook_slug}" not found.')
                return

        report = generate_organization_report(notebook=notebook, timeline_limit=timeline_limit)
        if fmt == 'markdown':
            rendered = render_organization_report_markdown(report)
        else:
            rendered = json.dumps(report, indent=2)

        if output_path:
            output_file = Path(output_path).expanduser()
            output_file.parent.mkdir(parents=True, exist_ok=True)
            output_file.write_text(rendered, encoding='utf-8')
            self.stdout.write(str(output_file))
            return

        self.stdout.write(rendered)
