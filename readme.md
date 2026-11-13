# Hôm Nay Ăn Gì?

App đặt đồ ăn văn phòng chạy trên **LAN** (máy chủ Node.js + SQLite + WebSocket HTTPS).

> Đây là app vui — không sổ nợ, không chốt sổ, không theo dõi đã trả/chưa trả.

## Tài liệu

| File | Vai trò |
|---|---|
| [`design-toi-gian/PLAN-toi-gian.md`](design-toi-gian/PLAN-toi-gian.md) | Plan đợt 1 (hiện hành) |
| [`KIEN-TRUC-DE-XUAT.md`](KIEN-TRUC-DE-XUAT.md) | Kiến trúc đã review |
| [`agents.md`](agents.md) | Quy chuẩn cho agent / lập trình viên |
| [`design-toi-gian/ViaHe-*.dc.html`](design-toi-gian/) | Thiết kế 5 màn |
| [`design-toi-gian/mocks/`](design-toi-gian/mocks/) | Mock PNG + DESIGN Van Phòng Tuất |
| [`archive/`](archive/) | `thietke_v1/v2/v3` — tham khảo cũ, không sửa |
| [`app/`](app/) | Mã nguồn chạy được |
| [`app/docs/VAN-HANH.md`](app/docs/VAN-HANH.md) | Cài đặt & vận hành trên MAY3 |

`archive/thietke_v1.html` / `archive/thietke_v2.html` chỉ để tham khảo UI/logic cũ.

## Chạy nhanh (máy dev)

```bash
cd app
npm install
npm run seed   # nếu DB trống
npm run dev
```

Mở `https://localhost:8443` (chứng chỉ tự ký lúc dev). Tài khoản seed in PIN ra console lần đầu.

## Phạm vi đợt 1

Bàn (vote/order) · Vòng quay · Tính tiền + VietQR · Sổ ghi · Kho quán · AI đọc ảnh (nếu có key) · HTTPS LAN.

Không làm: mobile, chat, game sảnh, bot, webhook ngân hàng.
