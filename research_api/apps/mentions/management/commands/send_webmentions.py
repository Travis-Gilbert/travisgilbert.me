"""
Send outbound Webmentions for published content.

Usage:
    python manage.py send_webmentions --url https://travisgilbert.me/essays/some-slug
    python manage.py send_webmentions --all-recent
"""

from django.core.management.base import BaseCommand

from research_api.apps.mentions.sender import send_webmentions_for_content


class Command(BaseCommand):
    help = "Send outbound Webmentions for published content URLs."

    def add_arguments(self, parser):
        parser.add_argument("--url", type=str, help="Single content URL to process")
        parser.add_argument(
            "--all-recent",
            action="store_true",
            help="Process all content published in the last 7 days",
        )

    def handle(self, *args, **options):
        url = options.get("url")

        if url:
            self.stdout.write(f"Sending Webmentions for: {url}")
            result = send_webmentions_for_content(url)
            self.stdout.write(
                f"Discovered: {result['discovered']}, "
                f"Sent: {result['sent']}, "
                f"Failed: {result['failed']}"
            )
            for detail in result["details"]:
                status = "OK" if detail["sent"] else "FAIL"
                self.stdout.write(f"  [{status}] {detail['target']}")
        elif options.get("all_recent"):
            self.stdout.write("--all-recent not yet implemented (needs published content index)")
        else:
            self.stderr.write("Provide --url or --all-recent")
