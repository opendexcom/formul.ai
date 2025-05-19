#!/bin/sh
export PGPASSWORD="$POSTGRES_PASSWORD"
pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" -p 5432
