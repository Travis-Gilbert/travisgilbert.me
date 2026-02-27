from django.test import TestCase
from apps.intake.forms import CaptureForm, EnrichmentForm, MoveForm


class CaptureFormTest(TestCase):
    def test_single_url_valid(self):
        form = CaptureForm(data={"urls": "https://example.com"})
        self.assertTrue(form.is_valid())
        self.assertEqual(form.cleaned_data["url_list"], ["https://example.com"])

    def test_batch_urls_valid(self):
        urls = "https://a.com\nhttps://b.com\nhttps://c.com"
        form = CaptureForm(data={"urls": urls})
        self.assertTrue(form.is_valid())
        self.assertEqual(len(form.cleaned_data["url_list"]), 3)

    def test_blank_lines_filtered(self):
        urls = "https://a.com\n\n\nhttps://b.com\n"
        form = CaptureForm(data={"urls": urls})
        self.assertTrue(form.is_valid())
        self.assertEqual(len(form.cleaned_data["url_list"]), 2)

    def test_invalid_url_rejected(self):
        form = CaptureForm(data={"urls": "not-a-url"})
        self.assertFalse(form.is_valid())

    def test_empty_rejected(self):
        form = CaptureForm(data={"urls": ""})
        self.assertFalse(form.is_valid())


class EnrichmentFormTest(TestCase):
    def test_all_fields_optional_except_defaults(self):
        form = EnrichmentForm(data={
            "importance": "high",
            "source_type": "article",
        })
        self.assertTrue(form.is_valid())

    def test_tags_parsed_from_comma_string(self):
        form = EnrichmentForm(data={
            "importance": "medium",
            "source_type": "article",
            "tags_raw": "design, urbanism, history",
        })
        self.assertTrue(form.is_valid())
        self.assertEqual(form.cleaned_data["tag_list"], ["design", "urbanism", "history"])


class MoveFormTest(TestCase):
    def test_valid_move(self):
        form = MoveForm(data={"source_id": "1", "phase": "review"})
        self.assertTrue(form.is_valid())

    def test_invalid_phase(self):
        form = MoveForm(data={"source_id": "1", "phase": "invalid"})
        self.assertFalse(form.is_valid())
