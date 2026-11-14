---
name: verify-vanphongtuat
description: "Drive Hôm Nay Ăn Gì (Văn Phòng Tuất) in a real browser against an isolated seeded SQLite instance. Use to prove login, vote quán, gọi món, vòng quay, or tính tiền, and to capture screenshots plus DB/WebSocket side effects."
---

# Verify Văn Phòng Tuất

Primary surface is the web app in `app/` (hash routes, cookie session, WebSocket). Office install scripts under `app/tools/` are Windows-only and are not this harness. Never drive the tunnel on port 8443 or `app/data/hng.db`: that instance may be in use. This skill starts its own port and its own empty data dir.

## Launch

From the repo root, on a machine that already has `app/node_modules` (`npm ci` in `app/`):

```bash
.cursor/skills/verify-vanphongtuat/scripts/launch.sh 8466
```

The script deletes `/tmp/vanphongtuat-verify-run/data`, runs `npm run build` so `app/public/app.js` exists, then starts `npm run dev` with:

- `HNG_DEV_HTTP=1`
- `HNG_PORT=8466` (or the port argument)
- `HNG_ORIGIN=http://127.0.0.1:<port>` — the browser must use this host, not `localhost`, or login returns 403 csrf
- `HNG_DB=/tmp/vanphongtuat-verify-run/data/hng.db`
- `HNG_BACKUP_DIR=/tmp/vanphongtuat-verify-run/data/backup`

Ready means all of these, not merely an open port:

1. The log contains `SEED PIN` and `HNG server`.
2. `GET /api/roster` lists `"username":"minh"`.
3. `GET /app.js` returns 200.
4. `POST /api/login` for `minh` with the PIN parsed from that log returns the member `Minh (Bạn)`.

PINs are random per empty dir. They are written only to `/tmp/vanphongtuat-verify-run/pins.json`. Do not commit that file.

Teardown is `cleanup.sh` below. It does not delete `/tmp/vanphongtuat-verify-evidence`.

## Doctor

```bash
.cursor/skills/verify-vanphongtuat/scripts/doctor.sh
```

Read-only. It fails unless the pid recorded by `launch.sh` is alive, that process (or its child) owns the port, `GET /` references `/app.js`, `/app.js` downloads, roster contains `minh`, `GET /api/me` without a cookie is 401, and the sqlite file has at least 6 members and 1 shop.

## Drive

Harness is Playwright against system Chrome (`channel: 'chrome'`), viewport 1366×768 unless a feature file says 390×844.

Stable handles in this repo:

| Việc | Handle |
|---|---|
| Mở app | `http://127.0.0.1:<port>/#/home`, `#/ban`, `#/quay`, `#/tien`, `#/so`, `#/kho`, `#/sanh`, `#/quyen` |
| Chọn người | `getByRole('button', { name: 'Minh (Bạn)' })` (các tên seed khác giống vậy) |
| PIN | `#login-pin` |
| Vào | `getByRole('button', { name: 'VÀO SẢNH' })` |
| Đã vào | `getByText('CHÀO MINH!')` trên `#/home`, hoặc link `aria-label="Văn phòng Tuất, Hôm nay ăn gì?"` |
| Đăng xuất | nút avatar `data-act="avatar"`, rồi `#av-logout` |
| Vote quán | `button[data-vote]` (`aria-pressed`) |
| Chốt quán | `button[data-lock]`, accessible name `Chốt <tên quán>` |
| Gọi món | `#ban-note`, `button[data-menu]`, `getByRole('button', { name: 'GỌI' })` |
| Quay | `button[data-act="spin"]`, đĩa `#wheel-face`, kim `.hn-pointer-outer`, kết quả `.hn-wheel-winner` trong `[role="status"]` |
| Tính tiền | `#bill-total`, nhóm `aria-label="Cách chia"`, nút `data-mode="item"` / `data-mode="equal"` |

One mapped drive, đăng nhập:

```bash
node .cursor/skills/verify-vanphongtuat/scripts/drive-login.mjs
```

Recipes for the other features are in `features/`. Do not click by coordinates.

## Evidence

Proof directory: `/tmp/vanphongtuat-verify-evidence/`. Cleanup must not remove it.

Every proof includes the action and the state after it:

- Screenshot before the click and after the screen changes (`01-*.png`, `02-*.png`).
- A `result.json` with what the user can see (greeting, winner text, order line).
- A side effect that is not the screen: `auth_sessions` row count increased after login, an `orders` or `votes` row after gọi/vote, or a WebSocket frame received on the second browser context.

Do not prove a feature by writing SQL yourself or by calling a test-only route. Login, vote, spin, and bill go through the buttons above. Read-only SQL and `/api/me` are allowed as the second view of state the click already created. AI image routes stay unmocked: with no `HNG_AI_KEY` the user-visible result is the toast `AI chưa bật, nhập tay nhé` (kho) or the bill buttons doing nothing useful. Do not stub a provider to force a pass.

## Cleanup

```bash
.cursor/skills/verify-vanphongtuat/scripts/cleanup.sh
```

Sends TERM to the process group of the pid in `/tmp/vanphongtuat-verify-run/pid`, then deletes that state directory (data dir, log, pins). It does not kill `tsx` or `node` by name, and it does not delete `/tmp/vanphongtuat-verify-evidence`.

## Helpers

| Script | Invocation |
|---|---|
| Launch | `.cursor/skills/verify-vanphongtuat/scripts/launch.sh 8466` |
| Doctor | `.cursor/skills/verify-vanphongtuat/scripts/doctor.sh` |
| Drive đăng nhập | `node .cursor/skills/verify-vanphongtuat/scripts/drive-login.mjs` |
| Cleanup | `.cursor/skills/verify-vanphongtuat/scripts/cleanup.sh` |

When the map changes with the product, run `/maintain-verification-skill` rather than editing selectors from memory.

## Features

Read [features/README.md](features/README.md) before driving anything except the login proof above.
