"""
Add search_vector field and GIN index to Source.

PostgreSQL only: the field and index are skipped on SQLite.
"""

from django.db import connection, migrations


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('research', '0002_connectionsuggestion_sourcesuggestion'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE research_source
                ADD COLUMN IF NOT EXISTS search_vector tsvector;
            """,
            reverse_sql="""
                ALTER TABLE research_source
                DROP COLUMN IF EXISTS search_vector;
            """,
            state_operations=[],
        ),
        migrations.RunSQL(
            sql="""
                CREATE INDEX IF NOT EXISTS idx_source_search
                ON research_source USING gin(search_vector);
            """,
            reverse_sql="""
                DROP INDEX IF EXISTS idx_source_search;
            """,
            state_operations=[],
        ),
    ] if connection.vendor == 'postgresql' else [
        migrations.RunPython(noop, noop),
    ]
