#!/bin/bash

echo This is the initialisation script...
echo   POSTGRES_USER = ${POSTGRES_USER}
echo   POSTGRES_DB   = ${POSTGRES_DB}

function sqlCommand() {
  PGPASSWORD="${POSTGRES_PASSWORD}" psql -U${POSTGRES_USER} -w ${POSTGRES_DB} -c "$1"
}

function sqlFile() {
  PGPASSWORD="${POSTGRES_PASSWORD}" psql -U${POSTGRES_USER} -w ${POSTGRES_DB} -f $1
}

function sqlSubstitution() {
  PGPASSWORD="${POSTGRES_PASSWORD}" cat $1 | sed 's/${TABLE_PREFIX}/'${TABLE_PREFIX}'/g' | psql -U${POSTGRES_USER} -w ${POSTGRES_DB}
}

# The pgcrypto module is required for generating UUIDs as default values
sqlCommand 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'

# Activate PostGIS extensions before creating tables
sqlCommand 'CREATE EXTENSION IF NOT EXISTS postgis;'

# Active Timescale extension
sqlCommand 'CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;'

# Load basic schema v2
sqlSubstitution /tmp/sql/schema_v3.sql
