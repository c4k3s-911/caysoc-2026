#!/usr/bin/env bash
set -euo pipefail
# CaySoc Global - deploy helper for cx-serv1 (192.168.0.4, user cx). Run ON VPS.
# SECURITY: rotate shared credentials/keys; use SSH keys; restrict :3100.
CONF_DIR="${CONF_DIR:-/home/cx/caysoc/paperclip}"
APP_DIR="${APP_DIR:-$CONF_DIR/app}"
echo "=== CaySoc Global / Paperclip deploy (cx-serv1 192.168.0.4) ==="
mkdir -p "$APP_DIR" "$CONF_DIR"
[ -f "$APP_DIR/package.json" ] || { echo "Clone/copy Paperclip to $APP_DIR first."; exit 1; }
[ -f "$CONF_DIR/.env" ] || { echo "Create $CONF_DIR/.env from .env.cx-serv1.example"; exit 1; }
cd "$CONF_DIR"
docker compose -f docker-compose.cx-serv1.yml up -d
docker compose -f docker-compose.cx-serv1.yml ps
echo "Next: restrict 3100, rotate secrets, open Paperclip, import blueprint."
