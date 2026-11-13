# Báo cáo nghiệm thu OPS + kiểm thử (M6–M7 / đợt 1)

Ngày: 2026-11-12 · Worker: OPS + nghiệm thu · Workspace: `D:\vanphongtuat\app`

## 1. Đã giao

| Hạng mục | Trạng thái |
|---|---|
| `tools/make-ca.ps1` | Có — CA 5 năm + server cert 1 năm, SAN IP/MAY3 |
| `tools/install-root-ca.ps1` | Có — Import LocalMachine\Root |
| `tools/install-task.ps1` | Có — AtStartup, RestartCount=3 / 1 phút, log `C:\hng\logs` |
| `tools/firewall.ps1` | Có — TCP 8443, profile Private only |
| `docs/VAN-HANH.md` | Có — MAY3, HTTPS, backup/restore, gia hạn cert |
| `tests/unit/vietqr.test.ts` | Có — CRC vector + payload EMVCo |
| `tests/unit/maps.test.ts` | Có — `/maps/place/` + `?q=` |
| `tests/server/concurrent.test.ts` | Có — 15 client qua plan harness |
| `tests/helpers/plan-harness.ts` | Có — chống interface §5.2 |
| `tests/helpers/live-client.ts` | Có — probe server thật khi `HNG_CONCURRENT_URL` |
| `scripts/backup-restore-smoke.mjs` | Có |
| `npm run test` / `test:concurrent` / `test:backup-smoke` | Đã dây |

## 2. Lệnh chạy

```powershell
cd D:\vanphongtuat\app
npm run test
npm run test:concurrent
npm run test:backup-smoke
# Khi server that san sang + 15 user seed:
# $env:HNG_CONCURRENT_URL='https://localhost:8443'; $env:HNG_CONCURRENT_INSECURE='1'; npm run test:concurrent
```

## 3. Kết quả test (chạy thật 2026-11-12)

### `npm run test`

| Suite | Pass | Fail | Skip |
|---|---:|---:|---:|
| split | 10 | 0 | 0 |
| vietqr | 4 | 0 | 0 |
| maps | 6 | 0 | 0 |
| concurrent harness (15 users) | 7 | 0 | 0 |
| concurrent live server | 0 | 0 | 1 |
| **Tổng** | **27** | **0** | **1** |

### Concurrent 15 users (harness in-process)

- login ×15 OK
- `shop.upsert` / `table.create` / `table.addShop` OK
- `vote.set` đồng thời: **1 phiếu/người**; 8/5/2 → % 53/33/13; **một** quán DẪN ĐẦU
- `wheel.spin`: mọi client cùng `resultIndex`; spin lúc đang quay → `spinning`
- `table.setBill` + `split()` khớp unit; non-host → `forbidden`
- reconnect + **cùng `opId` không nhân đôi**
- Latency harness (tham chiếu, không phải MAY3 LAN): p50 ≈ 0.005–0.008 ms, p95 ≈ 0.08–0.14 ms, max &lt; 1 ms, 62 ops

Live server: **SKIP** — `src/server/index.ts` chưa có. Khi có: đặt `HNG_CONCURRENT_URL` để đo p95 ≤ 500 ms (chỉ tiêu §10).

### Backup restore smoke

- `backup.ts`: **CHƯA có**
- Kết quả API `better-sqlite3.backup()`: **PASS** (`docs/BACKUP-RESTORE-SMOKE.md`)

## 4. Checklist chức năng plan §10 — còn thiếu

| Mục §10 | Trạng thái |
|---|---|
| Unit split (+ random) | Đạt |
| Unit vietqr CRC | Đạt (payload mẫu nội bộ; **owner còn quét app ngân hàng**) |
| Unit maps | Đạt |
| Unit schema lệnh / perms | **Thiếu** (commands.ts / perms.ts chưa có) |
| Server: idempotency opId | Đạt trên harness; **chưa** trên SQLite/server thật |
| Server: conflict baseVersion | **Thiếu** |
| Server: PIN rate limit | **Thiếu** |
| Server: Origin/CSRF | **Thiếu** |
| Server: spin khi đang quay | Đạt trên harness |
| Server: setWinner spinId sai | **Thiếu** |
| E2E Playwright 15 máy UI | **Thiếu** (chưa server/client UI) |
| E2E: order/host sửa/conflict | **Thiếu** |
| E2E: mất mạng 30s, restart server, multi-tab | **Thiếu** trên live |
| E2E: AI / clipboard HTTPS / layout 1366×768 | **Thiếu** |
| Hiệu năng MAY3 p95 ≤ 500 ms, RSS ≤ 1 GB | **Chưa đo** (không có server trên MAY3) |
| Sao lưu phục hồi | Smoke API **PASS**; job 12:30 + giữ 14 bản chờ `backup.ts` |

## 5. Chặn / báo cho worker khác

- `src/server/**` và `src/client/**` gần như trống — concurrent live + E2E Playwright không chạy được.
- Không đụng UI screens / command handlers (đúng ràng buộc OPS).
- Tools `*.ps1` cần Admin khi chạy trên MAY3; chưa chạy thật trên máy này (không nâng quyền).

## 6. Mâu thuẫn tài liệu cũ (nhắc §0.5 / §11)

`agents.md` / specs cũ vẫn mô tả nợ, dòng bill, ship/voucher, Gmail — **không khớp** plan tối giản đợt 1. Không sửa theo chỉ đạo owner.
