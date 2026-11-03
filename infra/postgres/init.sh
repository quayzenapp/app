#!/bin/bash
# Runs once when the data volume is first created.
set -euo pipefail
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname quayzen <<-SQL
  CREATE DATABASE keycloak;
  CREATE DATABASE quayzen_ai;
  -- Non-owner, non-superuser role used by the app, so row level security applies to it.
  CREATE ROLE quayzen_app LOGIN PASSWORD '${QZ_APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
SQL
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname quayzen_ai -c 'CREATE EXTENSION IF NOT EXISTS vector;'
