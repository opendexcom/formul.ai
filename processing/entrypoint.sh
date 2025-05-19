#!/bin/bash

# Run migrations
uv run alembic upgrade heads

# Start application
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
