"""
Drop all notebook_* tables so migrations can recreate them cleanly.

Used to fix partial migration state where some tables exist and others
don't. Safe to run multiple times (uses DROP IF EXISTS CASCADE).

Usage:
    python manage.py reset_notebook_tables
"""

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Drop all notebook_* tables to fix partial migration state."

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT tablename FROM pg_tables "
                "WHERE tablename LIKE 'notebook_%%'"
            )
            tables = [row[0] for row in cursor.fetchall()]

        if not tables:
            self.stdout.write("No notebook_* tables found.")
            return

        with connection.cursor() as cursor:
            for table in tables:
                cursor.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE')
                self.stdout.write(f"Dropped {table}")

        self.stdout.write(
            self.style.SUCCESS(f"Dropped {len(tables)} notebook table(s).")
        )
