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

## Chạy local / dev

Cần **Node.js 22+** (`better-sqlite3` 13 không chạy trên Node cũ hơn). Lệnh dưới đây chạy từ thư mục gốc của repo.

```bash
cd app
npm ci
npm run build          # ra public/app.js và public/fonts (không commit)
npm run dev
```

`npm run dev` chỉ theo dõi server. Sửa file trong `src/client/` thì chạy lại `npm run build`.

### HTTP trên máy dev (không có chứng chỉ)

Không có file cert, server tự lắng nghe HTTP, nhưng `HNG_ORIGIN` mặc định vẫn là `https://localhost:8443`. Cookie đăng nhập và kiểm tra origin sẽ lệch, nên đăng nhập bị từ chối. Trên máy dev hãy chạy:

```bash
cd app
npm ci
npm run build
HNG_DEV_HTTP=1 HNG_ORIGIN=http://localhost:8443 npm run dev
```

Mở đúng `http://localhost:8443` (không dùng `127.0.0.1`, vì origin phải khớp). Lần đầu DB trống, server tự seed và **in PIN một lần** ra console. Không ghi PIN, file `.env`, hay `app/data/` vào git.

HTTPS trên LAN (CA nội bộ, máy văn phòng) nằm ở [`app/docs/VAN-HANH.md`](app/docs/VAN-HANH.md). Đọc ảnh bill/menu cần `HNG_AI_KEY` trong `app/.env`; không có key thì AI tắt, các màn còn lại vẫn chạy.

## Phạm vi đợt 1

Bàn (vote/order) · Vòng quay · Tính tiền + VietQR · Sổ ghi · Kho quán · AI đọc ảnh (nếu có key) · HTTPS LAN.

Không làm: mobile, chat, game sảnh, bot, webhook ngân hàng.
