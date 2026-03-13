from django.apps import AppConfig
import os
import sys


class NotebookConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notebook'
    verbose_name = 'Notebooks'

    def ready(self):
        import apps.notebook.signals  # noqa: F401

        # Load KGE embeddings on startup if available.
        # Gracefully no-ops if embeddings haven't been trained yet.
        try:
            from apps.notebook.vector_store import kge_store
            kge_store.load()
        except Exception:
            pass

        # Optional bootstrap: schedule nightly self-organization in RQ.
        # Enabled explicitly via env var to avoid surprising behavior in local/test.
        try:
            should_skip = any(
                arg in {'test', 'makemigrations', 'migrate', 'collectstatic'}
                for arg in sys.argv
            )
            if not should_skip and os.environ.get('ENABLE_SELF_ORGANIZE_SCHEDULER', '').lower() in ('1', 'true', 'yes'):
                from .scheduling import ensure_periodic_reorganize_schedule

                ensure_periodic_reorganize_schedule(force=False)
        except Exception:
            # Scheduling must never block app startup.
            pass

        # Pre-warm SBERT FAISS index in background thread (dev only).
        # On production (no PyTorch), this is a silent no-op.
        try:
            from apps.notebook.vector_store import _SBERT_AVAILABLE
            if _SBERT_AVAILABLE:
                import threading
                from apps.notebook.vector_store import _build_sbert_faiss_index

                def _prewarm_index():
                    try:
                        _build_sbert_faiss_index()
                    except Exception:
                        # Startup prewarm should never break app boot or test setup.
                        pass

                t = threading.Thread(
                    target=_prewarm_index, daemon=True,
                )
                t.start()
        except Exception:
            pass
