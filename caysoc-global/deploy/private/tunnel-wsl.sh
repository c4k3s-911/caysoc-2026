#!/usr/bin/env bash
# CaySoc private-access tunnel, run inside WSL.
# Exposes Paperclip (3100) and the unified dashboard (4310) on the WSL IP only.
# SSH to 192.168.100.19 is flaky: keep the tunnel alive with ServerAlive probes
# and an automatic restart loop. Run with: bash tunnel-wsl.sh &
set -eu
export SSHPASS="${CAYSOC_SSH_PASSWORD:-0}"
DST="${CAYSOC_SSH_HOST:-cx@192.168.100.19}"
LOG="${CAYSOC_TUNNEL_LOG:-/tmp/csg-tunnel-loop.log}"

pkill -f "ssh -g.*192.168.100.19" 2>/dev/null || true
sleep 1

while true; do
  sshpass -e ssh -g \
    -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
    -o ConnectTimeout=20 -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -N -L 4310:127.0.0.1:4310 -L 3100:127.0.0.1:3100 \
    "$DST" >> "$LOG" 2>&1
  echo "$(date -u) tunnel dropped, restarting in 5s" >> "$LOG"
  sleep 5
done
