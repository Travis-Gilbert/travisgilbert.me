from django.apps import AppConfig


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

        # Pre-warm SBERT FAISS index in background thread (dev only).
        # On production (no PyTorch), this is a silent no-op.
        try:
            from apps.notebook.vector_store import _SBERT_AVAILABLE
            if _SBERT_AVAILABLE:
                import threading
                from apps.notebook.vector_store import _build_sbert_faiss_index
                t = threading.Thread(
                    target=_build_sbert_faiss_index, daemon=True,
                )
                t.start()
        except Exception:
            pass
