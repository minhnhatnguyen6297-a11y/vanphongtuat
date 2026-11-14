#!/usr/bin/env bash
# Kill only the instance launch.sh started. Never delete evidence.
# Usage: .cursor/skills/verify-vanphongtuat/scripts/cleanup.sh
set -euo pipefail

STATE_DIR=/tmp/vanphongtuat-verify-run
EVIDENCE_DIR=/tmp/vanphongtuat-verify-evidence
PID_FILE="$STATE_DIR/pid"

if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    PGID=$(ps -o pgid= -p "$PID" | tr -d ' ')
    if [ -n "$PGID" ] && [ "$PGID" != "1" ]; then
      kill -TERM -"$PGID" 2>/dev/null || kill -TERM "$PID" 2>/dev/null || true
    else
      kill -TERM "$PID" 2>/dev/null || true
    fi
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$PID" 2>/dev/null || break
      sleep 0.2
    done
    if kill -0 "$PID" 2>/dev/null; then
      PGID=$(ps -o pgid= -p "$PID" | tr -d ' ' || true)
      [ -n "$PGID" ] && kill -KILL -"$PGID" 2>/dev/null || kill -KILL "$PID" 2>/dev/null || true
    fi
  fi
fi

rm -rf "$STATE_DIR"
echo "CLEANUP OK  evidence giữ tại $EVIDENCE_DIR"
