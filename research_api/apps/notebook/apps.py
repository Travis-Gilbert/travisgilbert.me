from django.apps import AppConfig


class NotebookConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notebook'
    verbose_name = 'Notebooks'

    def ready(self):
        import apps.notebook.signals  # noqa: F401
