#!/usr/bin/env bash
set -euo pipefail
# CaySoc cx-serv1 backup skeleton - adapt DB/container names to your deployment.
OUT="${OUT:-/home/cx/caysoc/backups}"
TS=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$OUT"
# Example Postgres dump (adjust): docker exec <pg> pg_dump -U paperclip paperclip > "$OUT/paperclip-$TS.sql"
# Example volume archive: docker run --rm -v caysoc_paperclip_data:/data -v "$OUT":/out alpine tar czf /out/caysoc_data-$TS.tgz /data
# Copy configs (no secrets): cp /home/cx/caysoc/paperclip/docker-compose*.yml "$OUT/" || true
echo "backup skeleton completed: $OUT ($TS) - IMPLEMENT DB/VOLUME COMMANDS FOR YOUR SETUP"
