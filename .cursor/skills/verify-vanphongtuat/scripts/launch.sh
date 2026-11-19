#!/usr/bin/env bash
# Start one isolated Hôm Nay Ăn Gì instance from an empty data dir.
# Usage: .cursor/skills/verify-vanphongtuat/scripts/launch.sh [port]
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../../../.." && pwd)
APP="$REPO_ROOT/app"
PORT="${1:-8466}"
STATE_DIR=/tmp/vanphongtuat-verify-run
DATA_DIR="$STATE_DIR/data"
LOG="$STATE_DIR/server.log"
EVIDENCE_DIR=/tmp/vanphongtuat-verify-evidence

mkdir -p "$STATE_DIR" "$EVIDENCE_DIR"
rm -rf "$DATA_DIR"
mkdir -p "$DATA_DIR/backup"

if [ ! -d "$APP/node_modules/tsx" ]; then
  echo "Thiếu dependency. Trong $APP chạy: npm ci" >&2
  exit 1
fi

# Client bundle is gitignored. Without it the page shell has no app.
(cd "$APP" && npm run build)

cd "$APP"
HNG_DEV_HTTP=1 \
HNG_PORT="$PORT" \
HNG_ORIGIN="http://127.0.0.1:$PORT" \
HNG_DB="$DATA_DIR/hng.db" \
HNG_BACKUP_DIR="$DATA_DIR/backup" \
npm run dev >"$LOG" 2>&1 &
echo $! >"$STATE_DIR/pid"
echo "$PORT" >"$STATE_DIR/port"

ready=0
for _ in $(seq 1 40); do
  if grep -q "SEED PIN" "$LOG" && curl -sf "http://127.0.0.1:$PORT/api/roster" | grep -q '"minh"'; then
    if curl -sf -o /dev/null "http://127.0.0.1:$PORT/app.js"; then
      ready=1
      break
    fi
  fi
  sleep 0.25
done

if [ "$ready" != 1 ]; then
  echo "Server chưa dùng được. Log: $LOG" >&2
  tail -n 40 "$LOG" >&2 || true
  exit 1
fi

python3 - "$LOG" "$STATE_DIR/pins.json" "$PORT" "$DATA_DIR/hng.db" <<'PY'
import json, re, sys
log, out, port, db = sys.argv[1:]
text = open(log, encoding="utf-8").read()
pins = {}
for m in re.finditer(r"^\s+(\w+)\s+.+?PIN=(\d{6})", text, re.M):
    pins[m.group(1)] = m.group(2)
if "minh" not in pins:
    raise SystemExit("Không đọc được PIN seed")
json.dump({"port": int(port), "origin": f"http://127.0.0.1:{port}", "db": db, "pins": pins}, open(out, "w"), indent=2)
PY

# Usable: a real login, not only an open port.
PIN=$(python3 -c 'import json;print(json.load(open("/tmp/vanphongtuat-verify-run/pins.json"))["pins"]["minh"])')
CODE=$(curl -s -o "$STATE_DIR/login-probe.json" -w "%{http_code}" \
  -H "content-type: application/json" \
  -H "origin: http://127.0.0.1:$PORT" \
  -H "x-hng: 1" \
  -d "{\"username\":\"minh\",\"pin\":\"$PIN\"}" \
  "http://127.0.0.1:$PORT/api/login")
if [ "$CODE" != 200 ]; then
  echo "Đăng nhập seed thất bại HTTP $CODE" >&2
  exit 1
fi
python3 -c 'import json;d=json.load(open("/tmp/vanphongtuat-verify-run/login-probe.json"));assert d["member"]["displayName"]=="Minh (Bạn)"'

echo "READY http://127.0.0.1:$PORT  db=$DATA_DIR/hng.db  pid=$(cat "$STATE_DIR/pid")"
