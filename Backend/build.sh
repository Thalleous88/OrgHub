#!/usr/bin/env bash
set -o errexit

python -m pip install uv
uv sync --frozen
uv run python backend/manage.py collectstatic --noinput
uv run python backend/manage.py migrate
