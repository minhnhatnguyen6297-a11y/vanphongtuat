#!/usr/bin/env bash
# Read-only: is the instance started by launch.sh worth driving?
# Usage: .cursor/skills/verify-vanphongtuat/scripts/doctor.sh
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/../../../.." && pwd)
STATE_DIR=/tmp/vanphongtuat-verify-run
PID_FILE="$STATE_DIR/pid"
PINS="$STATE_DIR/pins.json"

[ -f "$PID_FILE" ] && [ -f "$PINS" ] || { echo "DOCTOR FAIL: chưa launch"; exit 1; }
PID=$(cat "$PID_FILE")
PORT=$(python3 -c 'import json;print(json.load(open("/tmp/vanphongtuat-verify-run/pins.json"))["port"])')
ORIGIN=$(python3 -c 'import json;print(json.load(open("/tmp/vanphongtuat-verify-run/pins.json"))["origin"])')
DB=$(python3 -c 'import json;print(json.load(open("/tmp/vanphongtuat-verify-run/pins.json"))["db"])')

if ! kill -0 "$PID" 2>/dev/null; then
  echo "DOCTOR FAIL: pid $PID không sống"
  exit 1
fi

# Port must belong to that process or its child (npm -> node).
LISTEN_PID=$(PORT="$PORT" python3 - <<'PY'
import os
port = int(os.environ["PORT"])
inodes = set()
for path in ("/proc/net/tcp", "/proc/net/tcp6"):
    try:
        lines = open(path)
    except OSError:
        continue
    next(lines, None)
    for line in lines:
        parts = line.split()
        if len(parts) < 10 or parts[3] != "0A":
            continue
        hexport = parts[1].rsplit(":", 1)[-1]
        if int(hexport, 16) == port:
            inodes.add(parts[9])
found = []
for pid in os.listdir("/proc"):
    if not pid.isdigit():
        continue
    fd_dir = f"/proc/{pid}/fd"
    try:
        names = os.listdir(fd_dir)
    except OSError:
        continue
    for name in names:
        try:
            target = os.readlink(f"{fd_dir}/{name}")
        except OSError:
            continue
        if target.startswith("socket:[") and target[8:-1] in inodes:
            found.append(pid)
print(found[0] if found else "")
PY
)
if [ -z "$LISTEN_PID" ]; then
  echo "DOCTOR FAIL: không có process nghe cổng $PORT"
  exit 1
fi
if [ "$LISTEN_PID" != "$PID" ]; then
  # Accept a descendant of the recorded pid.
  PARENT=$LISTEN_PID
  OK=0
  for _ in 1 2 3 4 5 6; do
    [ "$PARENT" = "$PID" ] && OK=1 && break
    PARENT=$(ps -o ppid= -p "$PARENT" 2>/dev/null | tr -d ' ')
    [ -z "$PARENT" ] || [ "$PARENT" = "1" ] && break
  done
  if [ "$OK" != 1 ]; then
    echo "DOCTOR FAIL: cổng $PORT thuộc pid $LISTEN_PID, không phải pid launch $PID"
    exit 1
  fi
fi

if [ ! -f "$REPO_ROOT/app/public/app.js" ]; then
  echo "DOCTOR FAIL: thiếu app/public/app.js"
  exit 1
fi
HTML=$(curl -sf "$ORIGIN/") || { echo "DOCTOR FAIL: GET / không trả lời"; exit 1; }
echo "$HTML" | grep -q 'src="/app.js"' || { echo "DOCTOR FAIL: HTML không trỏ /app.js"; exit 1; }
curl -sf -o /dev/null "$ORIGIN/app.js" || { echo "DOCTOR FAIL: /app.js không tải được"; exit 1; }

ROSTER=$(curl -sf "$ORIGIN/api/roster") || { echo "DOCTOR FAIL: roster"; exit 1; }
echo "$ROSTER" | grep -q '"username":"minh"' || { echo "DOCTOR FAIL: roster không có minh"; exit 1; }
ME=$(curl -s -o /dev/null -w "%{http_code}" "$ORIGIN/api/me")
[ "$ME" = "401" ] || { echo "DOCTOR FAIL: /api/me không cookie phải 401, được $ME"; exit 1; }

python3 - "$DB" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
n = db.execute("select count(*) from members").fetchone()[0]
shops = db.execute("select count(*) from shops").fetchone()[0]
assert n >= 6, n
assert shops >= 1, shops
print(f"db members={n} shops={shops}")
PY

echo "DOCTOR OK origin=$ORIGIN pid=$PID db=$DB"
