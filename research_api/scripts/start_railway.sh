#!/usr/bin/env bash
set -euo pipefail

# Ensure the spaCy model exists (cached after first successful install).
python - <<'PY' >/dev/null 2>&1 || python -m spacy download en_core_web_md
import spacy
spacy.load("en_core_web_md")
PY

python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py ensure_superuser

# Run worker in background while keeping gunicorn as PID 1.
# Scheduler support enables recurring periodic_reorganize jobs.
python manage.py rqworker default engine ingestion --with-scheduler &
exec gunicorn config.wsgi \
  --bind "0.0.0.0:${PORT}" \
  --workers 2 \
  --access-logfile - \
  --error-logfile -
