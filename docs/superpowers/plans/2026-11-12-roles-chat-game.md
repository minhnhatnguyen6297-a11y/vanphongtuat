# Phân quyền · Chat · Sảnh game · Backlog UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai một thể phân quyền toàn cục 4 tầng, chat theo scope, sảnh mini game (chơi/khán giả), và backlog UI đã note trên app LAN hiện có.

**Architecture:** Mở rộng SQLite + command bus đợt 1. Quyền chỉ ở server (`hasPerm` = ma trận tier ∪ grant tạm). `host_id` bàn = người gánh lẻ / nhãn, không authorize. Chat ACL trên subscribe+send; fanout event. Game kinds: `caro` → `ca_ngua` → `ti_phu` (rút gọn, không bot).

**Tech Stack:** Node.js, TypeScript, better-sqlite3, ws, zod, Vanilla TS client, esbuild — như `app/`.

**Spec:** [`docs/superpowers/specs/2026-11-12-roles-chat-game-design.md`](../specs/2026-11-12-roles-chat-game-design.md)

## Global Constraints

- Neo-Brutalism ViaHe; không mobile; `esc()` mọi user text; PIN/cookie như đợt 1.
- Không commit trừ khi owner yêu cầu.
- TDD cho perms, chat ACL, game seat.
- **Owner đã duyệt + tự quyết**; agent tự chốt chi tiết còn lại.
- Migration SQL nằm ở **`app/migrations/`** (db.ts load từ đó), không phải `src/server/migrations/`.

## Review Focus

- Leo thang quyền: Phó không chiếm `perm.manage` / promote `chu_xi` / demote Chủ cuối.
- Chat scope leak giữa wheelId / game room.
- Nô lệ spin/host vì quên default.
- Client tin UI; matrix trống setWinner/setBill.
- Migration gãy session/seed PIN.

## File map

| Path | Responsibility |
|---|---|
| `app/migrations/002_roles_chat_game.sql` | Schema mới |
| `app/src/shared/perms-catalog.ts` | Perm keys + default matrix |
| `app/src/server/perms.ts` | `hasPerm`, bỏ host authorize |
| `app/src/shared/commands.ts` | perm/chat/game/wheel.delete/shop.delete/table residual/voteEnds |
| `app/src/server/commands/{perm,chat,game,shop,wheel,table}.ts` | Handlers |
| `app/src/client/screens/{quyen,sanh,quay,ban,kho,tien}.ts` | UI |
| `app/src/client/ui/{chat-panel,rail,avatar}.ts` | Chat; rail (+Sảnh); Quyền trong avatar |
| `app/tests/server/perms-matrix.test.ts` | Matrix + grants + anti-escalation |
| `app/tests/server/chat-scope.test.ts` | Scope isolation |
| `app/docs/E2E-CHUC-NANG.md` | Báo cáo E2E |

---

### Task 1: Migration + catalog + hasPerm

**Files:** `app/migrations/002_roles_chat_game.sql`, `perms-catalog.ts`, `perms.ts`, `tests/server/perms-matrix.test.ts`

- [ ] **Step 1:** Test fail-first gồm:
  - `dan_den` ¬`table.setBill`; `no_le` ¬`wheel.spin`; grant hết hạn → false; `chu_xi` có `perm.manage`
  - Anti-escalation: request/approve/grant/`setMatrix` với `perm.manage`|`perm.approve`|`member.admin` → forbidden
  - Grant hết hạn → `hasPerm` false
- [ ] **Step 2:** Chạy → fail.
- [ ] **Step 3:** Migration ở **`app/migrations/002_…`**, seed matrix, `hasPerm`, map `is_operator`→`chu_xi`; `admin.setOperator`/CLI đồng bộ `setTier` + invariant ≥1 `chu_xi`.
- [ ] **Step 4:** Test xanh.
- [ ] **Step 5:** `assertCommandAllowed` dùng `hasPerm`; bỏ `requireHost` cho bill/winner/pickup; order.edit_others theo perm; thêm `table.setResidualHost`.

---

### Task 2: Lệnh perm + màn `#/quyen`

**Files:** `commands.ts`, `commands/perm.ts`, `screens/quyen.ts`, `avatar.ts`, `router.ts`, `snapshots.ts` (không bắt buộc rail cho Quyền)

- [ ] **Step 1:** Test handlers: `setMatrix`/`setTier`/`request`/`approve`; `setMatrix` từ chối nếu 0 tầng còn `table.setWinner` hoặc `table.setBill`; `pho_xi` ¬`setTier`→`chu_xi`; `pho_xi` ¬disable/demote `chu_xi`; demote Chủ cuối → forbidden.
- [ ] **Step 2:** Handlers + snap `perms`/`members`.
- [ ] **Step 3:** UI ma trận + gán tầng + xin phép.
- [ ] **Step 4:** Entry **Quyền trong menu avatar** (nếu manage/approve); **không** thêm icon Quyền trên rail.

---

### Task 3: Chat scope (bàn + vòng quay) — làm trước Task 4

**Files:** `commands/chat.ts`, `ui/chat-panel.ts`, `quay.ts`, `ban.ts`, `ws.ts`

- [ ] Test ACL sub/send; hai wheel không leak; event fanout không full-snap mỗi tin.
- [ ] Implement + panel Quay theo wheel đang chọn; panel Bàn.

---

### Task 4: Backlog UI (sau Task 3 — tránh đua `quay.ts`)

- [ ] `wheel.delete` / `shop.delete` (block nếu đang tham chiếu) + tests.
- [ ] Fix `data-act=spin`; UI × xóa vòng; xóa quán; bỏ screenshot; thêm quán kho; countdown cosmetic + `voteEndsInSec` trên kê bàn.

---

### Task 5: Sảnh + games (gate cứng)

- [ ] **5a:** sảnh + room + seat + chat `game:` + engine **`caro` 15×15** → test xanh. **Cấm** scaffold ti_phu trước khi 5a xanh.
- [ ] **5b:** `ca_ngua` → test xanh.
- [ ] **5c:** `ti_phu` rút gọn → test xanh.
- [ ] Host seat được đi nước; `no_le` chỉ spectator. Không bot. Rail thêm **Sảnh**.

---

### Task 6: Nghiệm thu nhanh

- [ ] `npm test` xanh; smoke quyền; cập nhật `agents.md` ngắn.

### Task 7: E2E click (sau Task 6, LIVE)

- [ ] Server LIVE (không mock). Bấm thật: login → vote → order → quay → bill → kho → quyền (avatar) → chat → sảnh **caro** (bắt buộc). `ca_ngua`/`ti_phu` chỉ ghi pass nếu 5b/5c xong.
- [ ] `app/docs/E2E-CHUC-NANG.md`: chức năng | mục đích | pass/fail. Fail thật, không soft-pass.

### Task 8: Impeccable (sau E2E xanh)

- [ ] Polish spacing/hierarchy/contrast trên token ViaHe (`#FFF4D6`, `#C62828`, viền 3px, bóng cứng, Bungee/Be Vietnam). **Cấm** soft/pastel/Material/rounded-pill.

## Order

`1 → 2 → 3 → 4 → 5a → 5b → 5c → 6 → 7 → 8`

## Owner rulings

- Tự quyết; app vui đơn giản; không commit trừ khi hỏi.
- Vote countdown cosmetic; host_id = gánh lẻ; matrix không trống setWinner/setBill.
- Games: caro → cá ngựa → tỉ phú rút gọn; không bot.
