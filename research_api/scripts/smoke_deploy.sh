#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  PYTHON_BIN="python"
fi

echo "[smoke] django system check"
"${PYTHON_BIN}" manage.py check

echo "[smoke] migration plan check"
"${PYTHON_BIN}" manage.py showmigrations --plan >/dev/null

echo "[smoke] scheduler command health"
"${PYTHON_BIN}" manage.py ensure_reorganize_schedule --force >/tmp/ensure_reorganize_schedule.out

echo "[smoke] auto-classification calibration dry run"
"${PYTHON_BIN}" manage.py calibrate_auto_classify --include-note --limit 50 >/tmp/calibrate_auto_classify.out

echo "[smoke] reclassification dry run"
"${PYTHON_BIN}" manage.py reclassify_objects --dry-run --limit 50 >/tmp/reclassify_objects.out

echo "[smoke] deployment checks completed"
