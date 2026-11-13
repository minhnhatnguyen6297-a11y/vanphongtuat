# Nghiệm thu nhanh — Roles / Chat / Sảnh

Ngày: 2026-11-12 · Plan: `docs/superpowers/plans/2026-11-12-roles-chat-game.md`

## Unit / server

| Suite | Kết quả |
|---|---|
| `npm test` (split, maps, vietqr, auth, ops, perms, chat-scope, delete-refs, caro, ca_ngua, ti_phu) | **59/59 pass** |

## Điểm chốt

- Quyền theo **tầng toàn cục** + matrix; `host_id` bàn = gánh lẻ, không authorize.
- Chat ACL theo `tableId` / `wheelId`; không leak giữa hai wheel.
- Xóa quán/vòng bị chặn khi còn tham chiếu bàn.
- Game: create/start cần host; play theo lượt; nô lệ spectate OK, không play (mặc định).

## UI smoke (xem E2E)

Chi tiết click LIVE: [`E2E-CHUC-NANG.md`](E2E-CHUC-NANG.md) — **15/15 pass** (2026-11-12, Playwright Chrome, `http://127.0.0.1:8443`).
