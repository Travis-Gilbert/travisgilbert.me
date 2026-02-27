from unittest.mock import patch, MagicMock
from django.test import TestCase
from apps.intake.models import RawSource
from apps.intake.services import scrape_og_async


class ScrapeOgAsyncTest(TestCase):
    @patch("apps.intake.services.scrape_og_metadata")
    def test_scrape_og_async_success(self, mock_scrape):
        mock_scrape.return_value = {
            "title": "Test Article",
            "description": "A test description",
            "image": "https://example.com/img.png",
            "site_name": "Example",
        }
        source = RawSource.objects.create(
            url="https://example.com/article",
            scrape_status="pending",
        )
        scrape_og_async(source.pk)
        source.refresh_from_db()
        self.assertEqual(source.og_title, "Test Article")
        self.assertEqual(source.scrape_status, "complete")

    @patch("apps.intake.services.scrape_og_metadata")
    def test_scrape_og_async_failure(self, mock_scrape):
        mock_scrape.return_value = {
            "title": "",
            "description": "",
            "image": "",
            "site_name": "",
        }
        source = RawSource.objects.create(
            url="https://unreachable.example.com",
            scrape_status="pending",
        )
        scrape_og_async(source.pk)
        source.refresh_from_db()
        # Even with empty results, status should be complete (not failed)
        # Failed is reserved for exceptions
        self.assertEqual(source.scrape_status, "complete")

    @patch("apps.intake.services.scrape_og_metadata")
    def test_scrape_og_async_exception(self, mock_scrape):
        mock_scrape.side_effect = Exception("Network timeout")
        source = RawSource.objects.create(
            url="https://timeout.example.com",
            scrape_status="pending",
        )
        scrape_og_async(source.pk)
        source.refresh_from_db()
        self.assertEqual(source.scrape_status, "failed")
