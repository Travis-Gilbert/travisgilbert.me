import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("content", "0008_contentrevision"),
    ]

    operations = [
        migrations.CreateModel(
            name="Sheet",
            fields=[
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True, verbose_name="created at"
                    ),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True, verbose_name="updated at"),
                ),
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("content_type", models.CharField(max_length=50)),
                ("content_slug", models.SlugField(max_length=300)),
                (
                    "order",
                    models.IntegerField(
                        default=0,
                        help_text="Sort position within the content item. Not unique: bulk reorder updates all at once.",
                    ),
                ),
                ("title", models.CharField(blank=True, max_length=300)),
                ("body", models.TextField(blank=True)),
                (
                    "is_material",
                    models.BooleanField(
                        default=False,
                        help_text="Reference-only: excluded from publish concatenation.",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("idea", "Idea"),
                            ("drafting", "Drafting"),
                            ("locked", "Locked"),
                        ],
                        max_length=20,
                        null=True,
                    ),
                ),
            ],
            options={
                "ordering": ["content_type", "content_slug", "order"],
            },
        ),
        migrations.AddIndex(
            model_name="sheet",
            index=models.Index(
                fields=["content_type", "content_slug", "order"],
                name="idx_sheet_lookup",
            ),
        ),
    ]
