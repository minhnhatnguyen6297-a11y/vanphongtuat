# Nghiệm thu đợt 1 — FE↔BE live end-to-end

Ngày: 2026-11-12 · Worker: tích hợp + nghiệm thu cuối · Workspace: `D:\vanphongtuat`

## 1. Kết luận

**ĐẠT** cho mục tiêu đợt 1: cùng origin LIVE mặc định, login cookie + WS snap/cmd/ack, smoke chức năng chính, concurrent 15 live, `npm test` xanh. Không commit.

## 2. Lệnh chạy (Windows PowerShell)

```powershell
cd D:\vanphongtuat\app
# DB sạch (lần đầu / seed PIN mới):
# Remove-Item .\data\hng.db, .\data\hng.db-wal, .\data\hng.db-shm -ErrorAction SilentlyContinue

$env:HNG_DEV_HTTP = '1'
$env:HNG_ORIGIN = 'http://localhost:8443'
npm run build
npm run dev   # nền — in SEED PIN một lần khi DB trống

# Concurrent 15 (user u01..u15 PIN cố định):
node scripts/seed-concurrent.mjs
$env:HNG_CONCURRENT_URL = 'http://localhost:8443'
npm run test:concurrent

npm test
```

Server đang phục vụ: `http://localhost:8443` (static `public/index.html` + `app.js` + `styles.css` + fonts).

## 3. PIN seed (DB tạo 2026-11-12 ~17:01 UTC+7)

| username | displayName | PIN | role |
|---|---|---|---|
| minh | Minh (Bạn) | **033262** | operator |
| lan | Lan HR | 198100 | |
| tuan | Tuấn Dev | 542468 | |
| huong | Hương Kế Toán | 806298 | |
| hoang | Hoàng Design | 956695 | |
| thao | Thảo Marketing | 914057 | |

Concurrent (sau `node scripts/seed-concurrent.mjs`):

| username | PIN |
|---|---|
| u01 … u15 | 100001 … 100015 (u01 = operator) |

> PIN seed chỉ in một lần khi DB trống. Reset: xóa `data/hng.db*` rồi `npm run dev`, hoặc `npm run admin -- reset-pin <user>`.

## 4. Ghép FE↔BE (đã sửa)

| Lệch | Sửa |
|---|---|
| LIVE mặc định `false` / phải set `__HNG_LIVE__` | Cùng origin `http(s):` → LIVE; `file://` hoặc `__HNG_LIVE__=false` → mock |
| FE đọc `data.me`, BE trả `member` | `api.ts` map `member` (+ fallback `me`) |
| FE gọi `/api/roster` không có | Thêm `GET /api/roster` (username + displayName, không auth) |
| WS snap thiếu `t:'snap'` | `ws.ts` gửi `{ t:'snap', ...snap }` |
| Sổ ghi trống (không có `tables`) | `snapCurrentTable` → `{ table, tables }`; client upsert legacy |
| LIVE login lỗi vẫn fallback mock | Bỏ fallback mock khi LIVE |
| Concurrent live skip / tên quán trùng / IP 429 | Bật live assert; tên unique; DEV HTTP IP limit 200 |

## 5. Kết quả test

### `npm test` — **31 pass / 0 fail**

| Suite | Pass |
|---|---:|
| auth PIN lockout & CSRF | 6 |
| ops idempotency & conflict | 5 |
| maps | 6 |
| split | 10 |
| vietqr | 4 |

### `npm run test:concurrent` — **8 pass / 0 fail / 0 skip**

| Suite | Kết quả |
|---|---|
| harness 15 (in-process) | PASS — vote 1 phiếu/người, spin đồng nhất, setBill+split, opId idempotent |
| **live server 15** | **PASS** — logins=15, votes=15, spinResultIndex set, errors=[], **p95 ≈ 227 ms** (≤ 500) |

Evidence (live lần cuối):

```json
{"logins":15,"votes":15,"spinResultIndex":0,"p50Ms":44.75,"p95Ms":227.14,"maxMs":247.14,"errors":[]}
```

### Smoke HTTP/WS (script)

- `GET /` `/app.js` `/styles.css` `/api/roster` → 200  
- `POST /api/login` Origin+X-HNG → cookie `hng_sid` + `member`  
- `GET /api/me` → 200  
- WS hello → snap `table:current` / shops / wheels / members  
- `shop.upsert` → `table.create` → vote ×2 user → `wheel.spin` → `order.add` → `table.setBill` → OK  

### UI smoke (cursor-ide-browser → `http://localhost:8443`)

| Màn | Kết quả |
|---|---|
| Login roster LIVE | Có seed + u01..u15; logout/login PIN minh OK |
| Bàn / vote | Vote hiện **DẪN ĐẦU** + **GHẾ CỦA BẠN**; Neo-Brutalism giữ |
| Quay | Wheel list + QUAY NGAY hiển thị |
| Sổ ghi | Sau fix snap: đủ lịch sử bàn #1…#8 |
| Kho | Danh sách quán + form thêm quán |

## 6. Checklist chức năng đợt 1

| Mục | Trạng thái |
|---|---|
| Thêm quán (`shop.upsert`) | Đạt (API + UI kho) |
| Vote (≥2 user, % / dẫn đầu) | Đạt (smoke + concurrent + UI) |
| Quay (`wheel.spin`, cùng result) | Đạt |
| Chia bill (`table.setBill` + split client) | Đạt (setBill host-only; split FE) |
| UI login → bàn → vote | Đạt |
| Cookie `hng_sid` + CSRF Origin/X-HNG | Đạt |
| opId idempotent | Đạt (ops test + concurrent live) |
| ~15 concurrent | Đạt live p95 &lt; 500 ms |

## 7. Việc còn mở

- **AI key** — `/api/ai/*` trả 503 `ai_disabled` khi thiếu `HNG_AI_KEY`
- **HTTPS LAN MAY3** — chưa chạy `tools/*.ps1` Admin / cert máy thật; hiện `HNG_DEV_HTTP=1`
- **Playwright E2E 15 máy UI** — chưa; đã có HTTP/WS concurrent + 1 browser smoke
- **Đo RSS ≤ 1 GB / p95 LAN** — mới đo localhost (p95 ~227 ms)
- **Sao lưu lịch 12:30 + giữ 14 bản** — `backup.ts` startup có; job Task Scheduler chờ MAY3
- **VietQR quét app ngân hàng thật** — unit CRC OK; owner còn quét thực tế
- PIN seed chỉ hiện console một lần — nên lưu an toàn khi seed production-like

## 8. File đụng chính

- `app/src/client/api.ts`, `app/src/client/ws.ts`, `app/public/index.html`
- `app/src/server/http.ts` (`/api/roster`), `ws.ts`, `snapshots.ts`, `auth.ts`
- `app/tests/helpers/live-client.ts`, `app/tests/server/concurrent.test.ts`
- `app/scripts/seed-concurrent.mjs`
