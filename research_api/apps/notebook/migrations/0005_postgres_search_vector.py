"""
Add Postgres FTS search_vector and GIN index for notebook_object.

PostgreSQL only: no-op on SQLite to preserve local development fallback.
"""

from django.db import connection, migrations


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('notebook', '0004_no_self_edges_constraint'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE notebook_object
                ADD COLUMN IF NOT EXISTS search_vector tsvector;
            """,
            reverse_sql="""
                ALTER TABLE notebook_object
                DROP COLUMN IF EXISTS search_vector;
            """,
            state_operations=[],
        ),
        migrations.RunSQL(
            sql="""
                CREATE INDEX IF NOT EXISTS idx_notebook_object_search_vector
                ON notebook_object USING gin(search_vector);
            """,
            reverse_sql="""
                DROP INDEX IF EXISTS idx_notebook_object_search_vector;
            """,
            state_operations=[],
        ),
        migrations.RunSQL(
            sql="""
                UPDATE notebook_object AS o
                SET search_vector = (
                    setweight(to_tsvector('english', coalesce(o.title, '')), 'A')
                    || setweight(to_tsvector('english', coalesce(o.body, '')), 'B')
                    || setweight(to_tsvector('english', coalesce(o.search_text, '')), 'C')
                    || setweight(
                        to_tsvector(
                            'english',
                            coalesce(
                                (
                                    SELECT string_agg(c.value::text, ' ')
                                    FROM notebook_component c
                                    WHERE c.object_id = o.id
                                ),
                                ''
                            )
                        ),
                        'D'
                    )
                );
            """,
            reverse_sql=migrations.RunSQL.noop,
            state_operations=[],
        ),
    ] if connection.vendor == 'postgresql' else [
        migrations.RunPython(noop, noop),
    ]
