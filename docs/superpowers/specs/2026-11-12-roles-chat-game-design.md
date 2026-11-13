# Design: Phân quyền toàn cục · Chat theo scope · Sảnh / mini game

> Ngày: 12/11/2026 · Owner: Minh · Căn cứ phiên brainstorm  
> Code nền: `app/` (đợt 1 LAN đã chạy) · UI: Neo-Brutalism ViaHe  
> Review: [Architecture review](e061c4f9-4b5b-4109-861a-5f861bdd09c2) → Approve with changes (đã vá) · [Builder-check](a9343129-1823-4f3b-9269-0d92cea1685b)  
> Trạng thái: **chờ owner duyệt toàn văn** (§12 đã đóng)

**Supersedes:** ma trận quyền theo `host_id` trong `design-toi-gian/PLAN-toi-gian.md` §0.2/§3; tách đợt “chat chung / game” trong `KIEN-TRUC-DE-XUAT.md` — gộp vào một đợt triển khai sau khi doc này được duyệt.  
**Giữ:** quy tắc chia tiền / `hostCovers` (người gánh lẻ = `tables.host_id`).

---

## 1. Intent

Nền tảng vui văn phòng LAN: ăn uống + tầng quyền chỉnh được + chat theo phòng + sảnh game (chơi / khán giả). Triển khai một thể sau duyệt thiết kế.

## 2. Goals / Non-goals / Anti-goals

**Goals** — 4 tầng toàn cục + `#/quyen`; authorize ghi bằng `hasPerm` (không bằng `host_id`); chat scope tách; sảnh + 3 kind game (Caro → Cá ngựa → Tỉ phú rút gọn); backlog UI đã note; Nô lệ = khán giả được.

**Non-goals** — Mobile; bot Zalo/Slack; webhook NH; nợ/đã trả; AI local; **bot trong game**.

**Anti-goals** — Soft corporate UI; client-only ACL; chat global; Nô lệ chơi được vì quên default; leo thang `perm.manage`.

## 3. Constraints

PC LAN ~15 · Node/SQLite/WSS · Vanilla TS · `esc()` · font local · bỏ `getDisplayMedia` · không commit trừ khi owner yêu cầu.

---

## 4. Phân quyền

### 4.1 Tầng

| id | Nhãn | Ghi chú |
|---|---|---|
| `chu_xi` | Chủ xị | Full; riêng `perm.manage` |
| `pho_xi` | Phó xị | Trừ `perm.manage`; có `perm.approve` |
| `dan_den` | Dân đen lang thang | Cơ bản |
| `no_le` | Nô lệ | Vote + order; game chỉ spectate |

Migration: `is_operator=1` → `chu_xi`, else `dan_den`. Sau migration, `admin.setOperator` = `perm.setTier` tới/khỏi `chu_xi` (cùng invariant §4.5).

### 4.2 `host_id` bàn — mô hình kép (vá architecture)

| Vai trò | Nghĩa |
|---|---|
| **Authorize ghi** | Chỉ `hasPerm(...)` toàn cục — **không** `requireHost` |
| **`tables.host_id`** | Người **chịu trách nhiệm bàn**: mặc định = người `table.create`; nhãn UI “Chủ xị bàn”; **`hostCovers` / gánh lẻ** luôn theo field này |
| Đổi người gánh lẻ | Lệnh `table.setResidualHost{memberId}` cần `table.setBill` (hoặc perm riêng nếu tách sau) |

Người kê bàn **không** tự nhận quyền chốt quán/bill.  
Invariant: luôn ≥1 thành viên `chu_xi`; không cho hạ/demote Chủ xị cuối cùng.

### 4.3 Catalog + map lệnh → perm

| perm_key | Lệnh / điều kiện |
|---|---|
| `vote` | `vote.set` |
| `order` | `order.add`; `order.update/remove` khi order của mình |
| `order.edit_others` | `order.update/remove` order người khác |
| `table.create` | `table.create` (+ `voteEndsInSec`) |
| `table.addShop` | `table.addShop` |
| `table.setWinner` | `table.setWinner` |
| `table.setBill` | `table.setBill`; `table.setResidualHost` |
| `table.setPickup` | `table.setPickup` |
| `shop.add` | `shop.upsert` khi tạo mới |
| `shop.edit` | `shop.upsert` khi sửa; `shop.setMenu` |
| `shop.delete` | `shop.delete` |
| `wheel.create` | `wheel.create` |
| `wheel.edit` | `wheel.rename`, `wheel.item.*`, `wheel.equalize`, `wheel.byVote` |
| `wheel.delete` | `wheel.delete` |
| `wheel.spin` | `wheel.spin` |
| `chat.send` / `chat.mod` | `chat.send` / `chat.delete` (mod) |
| `game.*` | lệnh `game.*` tương ứng |
| `perm.manage` | `perm.setMatrix`, `perm.setTier` (và mở tab Ma trận) |
| `perm.approve` | `perm.approve` / `perm.deny` |
| `member.admin` | `admin.*` / tạo·khóa·reset PIN |

**Ma trận mặc định** — như đã chốt (Chủ/Phó có setWinner/Bill/Pickup/edit_others; Dân có vote/order/table.create/addShop/shop.add·edit/wheel.create·edit·spin/chat.send/game.play·spectate; Nô lệ vote+order+chat.send+game.spectate; chỉ Chủ có `perm.manage`; Phó có `perm.approve` + `member.admin` mặc định).

**Nô lệ UI:** luôn vào được `#/ban` và `#/quay` (xem); không spin/edit/delete; `chat.send` trên scope được phép (§5.2).

### 4.4 Xin phép / grant

- Grant tạm **24h**, một `perm_key`, không đổi tier.
- **Cấm** grant / approve / `setMatrix` cho: `perm.manage`, `perm.approve`, `member.admin` (không leo thang qua xin phép).
- `perm.setTier` → `chu_xi` chỉ actor đang là `chu_xi`.
- Phó **không** `member.admin` disable / đổi tier của `chu_xi`.

### 4.5 Màn `#/quyen`

Tab Ma trận · Thành viên · Xin phép. Hiện nếu `perm.manage` hoặc `perm.approve` (approve chỉ tab Duyệt). Quyền: vào **menu avatar** (không thêm icon rail bắt buộc).

---

## 5. Chat

### 5.1 Scope

`table:{id}` | `wheel:{id}` | `game:{roomId}` — không trộn.

### 5.2 ACL subscribe + send (vá architecture)

| Scope | Được sub / send khi |
|---|---|
| `table:T` | Đã login + (mọi thành viên active được xem bàn hiện tại / bàn T trong sổ nếu policy mở — **mặc định: mọi member không disabled** với bàn trong DB) + `chat.send` để gửi |
| `wheel:W` | Member không disabled + vòng W tồn tại + đang không bị ẩn; gửi cần `chat.send` |
| `game:R` | Có hàng `game_members(R, me)` + `chat.send` để gửi |

Server **từ chối** snap/sub nếu không đủ ACL. Đổi vòng / rời phòng → client gửi lại `hello` với sub mới; server không giữ sub cũ.

**Fanout:** event `{t:'chat', scope, msg}` tới subscriber; **không** gửi lại full 100 tin mỗi lần. Snap 100 chỉ lúc hello/resub. Soft-delete vẫn trong event.

**Xóa tin:** chính chủ trong 2 phút; `chat.mod` mọi lúc. Body ≤ 500; ~2 tin/s/user.

---

## 6. Sảnh / game

### 6.1 Seat

Một hàng `game_members` / người / phòng.  
**Host cũng chơi được:** `seat=host` ⇒ được đi nước như player (không cần hàng `player` thứ hai). `spectator` chỉ xem. Nô lệ chỉ `spectator`.

### 6.2 Kind (owner đã chốt 12/11)

| kind | Luật đợt 1 | Nguồn hướng |
|---|---|---|
| `caro` | 15×15, 5 liền; 2 chơi; **không bot** | Viết mới engine; tham khảo OSS |
| `ca_ngua` | 2–4 người, luật Ludo VN cơ bản; **không bot** | Port engine MIT (vd CyberCitizen01/LUDO), UI tự vẽ |
| `ti_phu` | Theme **Cờ tỉ phú văn phòng**; **rút gọn** (không nhà/KS); 2–6 người; **không bot** | Viết mới + mượn luật; tránh thương hiệu Monopoly |

Thứ tự ship trong đợt: **caro → ca_ngua → ti_phu** (có thể UI sảnh hiện cả 3; implement tuần tự trong cùng plan).

### 6.3 Phòng

`game_rooms` + `game_members`; sảnh `#/sanh` (icon rail). Chat `game:` trong phòng. Không Elo/voice/bot.

---

## 7. Backlog UI (cùng đợt)

1. Fix QUAY NGAY · 2. Xóa vòng · 3. Chat vòng · 4. Xóa quán · 5. Bỏ chụp MH · 6. Thêm quán từ kho · 7. Đếm ngược vote (+ setup khi kê bàn)

**Xóa quán / vòng đang dùng (builder call):** **chặn cứng** nếu còn tham chiếu (quán trên bàn chưa xong / vòng còn trong list active); toast rõ; không cascade xóa chat (giữ lịch sử theo scope id).

**Đếm ngược vote (owner 12/11):** hết giờ **không khóa vote, không tự chốt**. Chỉ UI (motion/áp lực). `vote.set` vẫn nhận bình thường sau `vote_ends_at`.

---

## 8. Migration (phác)

`members.tier` · `role_permissions` · `perm_grants` · `perm_requests` · `chat_messages` · `game_rooms` · `game_members` · `tables.vote_ends_at` · giữ `host_id`.

## 9. Bảo mật

`hasPerm` = matrix ∪ grant hợp lệ; invariant §4.4–4.5 trên server + test; chat escape; ACL sub §5.2.

## 10. Builder quyết (nhỏ)

Layout panel chat; skin Neo-Brutalism bàn cờ; copy tem tầng trên avatar.

## 11. Success

Ma trận đổi → lệnh cấm tức thì; Nô lệ spectate+chat được, play/spin/delete không; chat wheel A ≠ B; 3 kind theo §6.2; backlog UI xanh; `npm test` + concurrent quyền.

## 12. Owner đã trả lời

1. Hết giờ vote → **không làm gì về logic**; UI motion tạo áp lực; vẫn vote được.  
2. Gánh lẻ theo **`host_id` bàn** (mô hình kép §4.2) — **OK**.  
3. **A** — không cho tắt hết: luôn ≥1 tầng còn `table.setWinner` và ≥1 tầng còn `table.setBill` (thường giữ trên `chu_xi`). Server từ chối `perm.setMatrix` nếu vi phạm.

---

## 13. Calls đã tự chốt (sau review)

- Grant không leo thang tới manage/approve/member.admin.  
- Host game = chơi được.  
- Chat: event tăng dần; ACL sub theo §5.2.  
- Xóa shop/wheel: block nếu đang tham chiếu.  
- Nô lệ xem ban/quay + chat scope được phép.  
- Phó mặc định có `member.admin` nhưng không đụng `chu_xi`.  
- Quyền trong avatar; Sảnh trên rail.  
- Game: 15×15 caro, tỉ phú rút gọn, không bot, thứ tự caro→cá ngựa→tỉ phú.  
- Vote countdown: cosmetic only.  
- Ma trận không được để trống quyền chốt quán / nhập bill.
