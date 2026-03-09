# CommonPlace Infrastructure: Redis, S3, and Architecture Improvements

> Infrastructure additions to support the redesign features.
> Redis for task queues and caching. S3 for file storage.
> Prerequisites for Pass 2 and Pass 3 features.

---

## 1. Redis on Railway

### Why

The connection engine currently runs in `threading.Thread(daemon=True)` spawned
from the request handler (`services.py _run_engine_async()`). This has problems:
- Container restart kills in-flight engine runs silently
- No job monitoring, retry, or rate limiting
- SBERT FAISS index lives in process memory (each gunicorn worker rebuilds its own copy)
- Compose Live Graph endpoint could fire 10+ times/minute/user with no server-side throttle

### What to add

**Railway:** Add Redis addon (one-click). Copy the `REDIS_URL` env var.

**Python dependencies:**
```
django-rq>=2.10.0
```

**Django settings:**
```python
# settings.py
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379'),
    }
}

RQ_QUEUES = {
    'default': {
        'URL': os.environ.get('REDIS_URL', 'redis://localhost:6379'),
        'DEFAULT_TIMEOUT': 300,
    },
    'engine': {
        'URL': os.environ.get('REDIS_URL', 'redis://localhost:6379'),
        'DEFAULT_TIMEOUT': 600,  # Engine runs can take a while with SBERT
    },
    'ingestion': {
        'URL': os.environ.get('REDIS_URL', 'redis://localhost:6379'),
        'DEFAULT_TIMEOUT': 120,
    },
}

INSTALLED_APPS += ['django_rq']
```

**Replace threading with RQ tasks:**
```python
# apps/notebook/tasks.py (NEW)
import django_rq

@django_rq.job('engine')
def run_engine_task(obj_pk: int, notebook_slug: str = ''):
    from .engine import run_engine
    from .models import Object, Notebook
    obj = Object.objects.get(pk=obj_pk)
    notebook = Notebook.objects.filter(slug=notebook_slug).first() if notebook_slug else None
    run_engine(obj, notebook=notebook)

@django_rq.job('ingestion')
def run_file_ingestion_task(obj_pk: int, file_key: str):
    """Async file processing (SAM-2, heavy OCR, etc.)"""
    from .models import Object
    from .file_ingestion import run_heavy_extraction
    obj = Object.objects.get(pk=obj_pk)
    run_heavy_extraction(obj, file_key)
```

**Update services.py:**
```python
# Replace:
#   _run_engine_async(obj.pk, notebook_slug=notebook_slug)
# With:
from .tasks import run_engine_task
run_engine_task.delay(obj.pk, notebook_slug=notebook_slug)
```

**SBERT index in Redis cache:**
```python
# vector_store.py: Replace _SBERT_INDEX_CACHE module dict with Redis
from django.core.cache import cache

def _get_cached_sbert_index():
    cached = cache.get('sbert_faiss_index')
    if cached:
        return pickle.loads(cached)
    return None

def _set_cached_sbert_index(index_data):
    cache.set('sbert_faiss_index', pickle.dumps(index_data), timeout=7200)
```

**RQ worker in Railway startCommand:**
```toml
# railway.toml: add worker process
# Option A: Run worker in same container (simpler, less isolation)
startCommand = "... && gunicorn config.wsgi ... & python manage.py rqworker default engine ingestion"

# Option B: Separate Railway service for workers (better isolation)
# Create a second Railway service pointing to same repo with:
startCommand = "python manage.py rqworker default engine ingestion --with-scheduler"
```

**Recommendation:** Option B (separate worker service) is better for production.
The worker can be scaled independently and does not compete with web requests
for CPU/memory. Both services share the same Postgres and Redis.

### Redis uses summary

| Use | Key pattern | TTL |
|---|---|---|
| SBERT FAISS index | `sbert_faiss_index` | 2 hours |
| TF-IDF matrix | `tfidf_matrix` | 2 hours |
| Compose query cache | `compose:{user_id}:{text_hash}` | 5 minutes |
| Rate limiting | `ratelimit:{user_id}:{endpoint}` | 1 minute |
| Capture queue status | `capture:{obj_sha}:status` | 1 hour |

---

## 2. S3-Compatible Object Storage

### Why

Uploaded files (PDFs, images, DOCX) are currently processed in the request
and discarded. The extracted text goes into the Object body, but the original
binary is gone. This means:
- Cannot re-run extraction with improved algorithms
- Cannot generate thumbnails on demand
- Cannot show original file in the Info tab
- Cannot serve file downloads to users
- If OCR or SAM-2 improves, users must re-upload

### What to add

**Python dependencies:**
```
django-storages>=1.14.0
boto3>=1.34.0
```

**Django settings:**
```python
# settings.py
DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', 'commonplace-files')
AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'us-east-1')
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = 'private'
AWS_S3_OBJECT_PARAMETERS = {
    'CacheControl': 'max-age=86400',
}
```

**File storage pattern:**
```python
# In the capture view, after creating the Object:
if uploaded_file:
    from django.core.files.storage import default_storage
    file_key = f'objects/{obj.sha_hash}/{uploaded_file.name}'
    default_storage.save(file_key, uploaded_file)
    # Store the key on the Object for later retrieval
    obj.properties['file_key'] = file_key
    obj.properties['file_name'] = uploaded_file.name
    obj.properties['file_size'] = uploaded_file.size
    obj.properties['file_mime'] = uploaded_file.content_type
    obj.save(update_fields=['properties'])
```

**Thumbnail generation and storage:**
```python
# After image extraction, store the thumbnail in S3 too
thumb_key = f'thumbnails/{obj.sha_hash}.png'
default_storage.save(thumb_key, ContentFile(thumb_bytes))
obj.properties['thumbnail_key'] = thumb_key
```

### Railway setup

Railway supports S3-compatible storage via:
1. **AWS S3** (recommended for production): Create an S3 bucket, IAM user with
   PutObject/GetObject/DeleteObject permissions, set env vars on Railway.
2. **Railway Volume** (simpler but less durable): Mount a volume at `/data/files`.
   Use Django's `FileSystemStorage` pointed at the mount path.

---

## 3. Postgres Full-Text Search

### Why

The command palette needs server-side search. With thousands of objects,
client-side filtering is insufficient. Postgres has built-in full-text
search via `tsvector` and `GIN` indexes.

### Migration

```python
# New migration for Object model
from django.contrib.postgres.search import SearchVectorField
from django.contrib.postgres.indexes import GinIndex

class Migration(migrations.Migration):
    operations = [
        migrations.AddField(
            model_name='object',
            name='search_vector',
            field=SearchVectorField(null=True),
        ),
        migrations.AddIndex(
            model_name='object',
            index=GinIndex(fields=['search_vector'], name='idx_obj_fts'),
        ),
    ]
```

**Populate on save (signals.py):**
```python
from django.contrib.postgres.search import SearchVector

def update_search_vector(sender, instance, **kwargs):
    Object.objects.filter(pk=instance.pk).update(
        search_vector=(
            SearchVector('title', weight='A') +
            SearchVector('body', weight='B') +
            SearchVector('search_text', weight='C')
        )
    )
```

**Search endpoint:**
```python
from django.contrib.postgres.search import SearchQuery, SearchRank

def search_objects(query_text, user, limit=20):
    query = SearchQuery(query_text, search_type='websearch')
    return (
        Object.objects
        .filter(search_vector=query, is_deleted=False, user=user)
        .annotate(rank=SearchRank('search_vector', query))
        .order_by('-rank')
        [:limit]
    )
```

---

## 4. Multi-User Foundation

### Why

Current models have no `user` foreign key. Everything is in one namespace.
Before SaaS launch, every model needs user scoping.

### What to add (Phase 2, not blocking Pass 1)

Add `user = models.ForeignKey(settings.AUTH_USER_MODEL)` to:
- Object
- Notebook
- Project
- Timeline

Add `.filter(user=request.user)` to every queryset in views.py.

This is a large migration. Sequence:
1. Add nullable `user` field with migration
2. Backfill existing objects to a default superuser
3. Make field non-nullable
4. Add queryset filtering to all views
5. Add user context to serializers

---

## 5. Export Endpoint

```python
# GET /api/v1/notebook/export/
# Returns a ZIP containing:
#   objects.json - all Objects
#   edges.json - all Edges
#   nodes.json - all Timeline Nodes
#   components.json - all Components
#   files/ - all attached files from S3
#   manifest.json - export metadata (date, version, counts)
```

Table stakes for user trust in a knowledge tool.

---

## Manual Steps (Travis)

1. Add Redis addon on Railway dashboard
2. Copy REDIS_URL env var to the Django service
3. Create AWS S3 bucket (or Railway Volume)
4. Set AWS env vars on Railway (ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET_NAME)
5. Create Aptfile in research_api root with `tesseract-ocr` and `tesseract-ocr-eng`
6. Deploy updated requirements
