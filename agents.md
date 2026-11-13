# BỘ QUY CHUẨN DÀNH CHO AI AGENTS & LẬP TRÌNH VIÊN (AGENTS.MD)
## DỰ ÁN: "HÔM NAY ĂN GÌ?" — APP ĂN UỐNG VĂN PHÒNG TRÊN LAN

> Plan hiện hành: [`design-toi-gian/PLAN-toi-gian.md`](design-toi-gian/PLAN-toi-gian.md)  
> Code chạy: [`app/`](app/) · Thiết kế màn: [`design-toi-gian/ViaHe-*.dc.html`](design-toi-gian/)  
> Kiến trúc: [`KIEN-TRUC-DE-XUAT.md`](KIEN-TRUC-DE-XUAT.md)

---

## 1. MỤC TIÊU & NHIỆM VỤ

Đây là **app vui**, không phải app quản lý / kế toán.

1. **Bảo tồn UI Neo-Brutalism** theo design trong `design-toi-gian/ViaHe-*.dc.html` (cream `#FFF4D6`, đỏ `#C62828`, vàng `#FFCF33`, xanh `#1F5FD1`, lá `#1B7A43`, mực `#1B1B1B`, cam `#F28C28`; font Bungee / Be Vietnam Pro / JetBrains Mono; viền 3px; bóng cứng 4–6px).
2. **Không** tự đổi sang soft/pastel, Bootstrap, Material Design.
3. **`thietke_v1.html` / `thietke_v2.html`** chỉ tham khảo. Không sửa. Không mang nợ, dòng bill, ship/voucher, Gmail vào đợt 1.
4. Mọi tính năng đợt 1 bám plan; máy chủ SQLite + WSS là nguồn dữ liệu duy nhất.

### Ngoài phạm vi đợt 1
Điện thoại/tablet · bot Zalo/Slack · webhook ngân hàng.

### Đã mở rộng (roles / chat / sảnh)
- Phân quyền **toàn cục theo tầng** (`chu_xi` / `pho_xi` / `dan_den` / `no_le`) + ma trận `role_permissions`; grant tạm 24h; anti-escalation (`perm.*` / `member.admin` không grant).
- **`tables.host_id` chỉ là người gánh lẻ** (nhãn / residual) — **không** authorize lệnh.
- Chat theo scope bàn (`tableId`) và vòng quay (`wheelId`); fanout event, không full-snap mỗi tin.
- Sảnh game: Caro / Cá ngựa / Tỉ phú rút gọn — host cần `game.host`; chơi cần `game.play`.

---

## 2. KIẾN TRÚC

```
Trình duyệt (Chrome/Edge, PC LAN)
        │ HTTPS + WSS
        ▼
Node.js trên MAY3  ── SQLite (WAL) ── backup 14 ngày
        │
        ├── Auth: username + PIN 6 số, cookie HttpOnly
        ├── Commands: transaction + opId idempotent + version
        └── AI queue: 1 job, ảnh chỉ trong RAM
```

| Lớp | Vị trí | Ghi chú |
|---|---|---|
| Shared | `app/src/shared/` | types, commands (zod), split, vietqr, maps |
| Server | `app/src/server/` | HTTPS, DB, auth, WS, perms, AI, admin-cli |
| Client | `app/src/client/` | Vanilla TS, template string + `esc()`, hash router |
| Tools | `app/tools/` | CA, root CA, Task Scheduler, firewall |

### Quyết định đã chốt
- Chỉ PC LAN (~15 máy). Không làm mobile đợt này.
- Chia tiền: bội 500đ; phần lẻ 0–499đ **Chủ xị gánh** (`hostCovers`). Port nguyên `design-toi-gian/split.reference.js`.
- Ảnh không ghi đĩa/log/backup. API key AI chỉ biến môi trường.
- Vòng quay: máy chủ chọn kết quả; "Chốt quán này" là thao tác riêng gắn `spinId`.

---

## 3. QUY ƯỚC MÃ NGUỒN

1. Biến/hàm: tiếng Anh. Nhãn UI / toast: tiếng Việt ngắn, không câu hướng dẫn dài.
2. Escape mọi dữ liệu người dùng khi render:
   ```ts
   function esc(str: unknown): string {
     return String(str ?? '').replace(/[&<>"']/g, s => (
       { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]!
     ));
   }
   ```
3. `AudioContext` chỉ `resume()` trong sự kiện click.
4. Không framework UI nặng. Font woff2 đóng gói local (không Google Fonts lúc chạy).
5. Mọi lệnh ghi qua máy chủ; client chỉ giữ nháp (`sessionStorage` / form).

### Ma trận quyền (tóm tắt — toàn cục theo tầng)
| Việc | Ai (mặc định) |
|---|---|
| Vote, gọi món mình, chat.send, spectate | Dân đen / Nô lệ (+ các tầng trên) |
| Kê bàn, thêm quán bàn/kho, sửa vòng, quay, chơi game | Dân đen trở lên |
| Sửa order người khác, set bill / chốt quán / pickup, xóa quán·vòng, chat.mod, host phòng game | Phó xị / Chủ xị |
| Sửa ma trận / set tầng (`perm.manage`) | Chỉ Chủ xị |
| Duyệt xin phép (`perm.approve`) | Phó xị / Chủ xị |
| Quản lý tài khoản (`member.admin`) | Phó xị / Chủ xị (`is_operator` ↔ `chu_xi`) |

UI quyền: Avatar → **Quyền** (`#/quyen`). Chi tiết nghiệm thu: [`app/docs/NGHIEM-THU-ROLES.md`](app/docs/NGHIEM-THU-ROLES.md).

---

## 4. CHECKLIST NGHIỆM THU ĐỢT 1

### Bàn
- [ ] Vote → % và tem **DẪN ĐẦU** đồng bộ; chốt → tem **CHỐT**
- [ ] Chip ghi chú nối vào ô; GỌI gửi `order.add`
- [ ] Copy order: chế độ quán (gom) và kèm tên

### Quay
- [ ] Vòng shop/person theo bàn; spin máy chủ; mọi máy cùng kết quả
- [ ] CHỐT QUÁN NÀY / GHI NGƯỜI ĐI LẤY gắn đúng `spinId`

### Tính tiền
- [ ] THEO MÓN / CHIA ĐỀU khớp `split()`; nhãn **Chủ xị gánh lẻ** khi có
- [ ] VietQR: STK Chủ xị, số tiền, nội dung `#<bàn> <TÊN>`

### Sổ / Kho
- [ ] Sổ: mọi bàn, mở rộng một dòng, kê lại bàn
- [ ] Kho: Maps parse tên, menu tay, lưu `shop.upsert` + `shop.setMenu`

### Nền
- [ ] Login/logout cookie; admin CLI; WS reconnect + idempotent `opId`
- [ ] Màn (trừ Sổ) vừa 1366×768; không media query thanh đáy mobile

---

## 5. TÀI LIỆU CŨ ĐÃ DỌN

Đã xoá `features.md`, `specs.md` (mô tả nợ / dòng bill / ship-voucher — lệch plan mới).  
`readme.md` và file này đã viết lại theo plan 12/11/2026.
