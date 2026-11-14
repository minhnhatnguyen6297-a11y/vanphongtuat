# AGENTS.md — Hôm Nay Ăn Gì?

App vui để văn phòng chọn quán, gọi món, quay người đi lấy, và chia tiền. Không sổ nợ, không theo dõi đã trả hay chưa.

Quy chuẩn giao diện và kiến trúc dài hơn nằm ở [`agents.md`](agents.md). Spec từng màn: [`docs/spec/`](docs/spec/).

## Không làm trên `main`

Tạo nhánh rồi mở pull request. Không commit PIN, file `.env`, `app/data/`, chứng chỉ, hay dữ liệu người thật. Seed trong app là tên và quán giả.

## Bố cục

| Chỗ | Việc |
|---|---|
| `app/src/server/` | HTTPS/HTTP, SQLite, lệnh, WebSocket |
| `app/src/client/` | Giao diện, hash router (`#/ban`, `#/quay`, …) |
| `app/src/shared/` | Kiểu, quyền, chia tiền, VietQR |
| `app/migrations/` | SQL chạy lúc mở DB |
| `app/public/` | HTML, CSS, ảnh. `app.js` và font do `npm run build` |
| `docs/spec/` | Hành vi người dùng và lý do |
| `docs/qa/` | Cách test và báo cáo đã bấm |
| `.cursor/skills/verify-vanphongtuat/` | Cách bật app và bấm bằng Playwright |

## Chạy và kiểm

Từ thư mục `app/` (cần Node.js 22+):

```bash
npm ci
npm run build
npm test
npm run e2e
```

Dev không chứng chỉ:

```bash
HNG_DEV_HTTP=1 HNG_ORIGIN=http://127.0.0.1:8443 npm run dev
```

Mở đúng `http://127.0.0.1:8443`. `npm run dev` không tự build client. Sửa `src/client/` thì chạy lại `npm run build`.

Cách bấm có kiểm chứng (launch, doctor, drive, evidence, cleanup): đọc [`.cursor/skills/verify-vanphongtuat/SKILL.md`](.cursor/skills/verify-vanphongtuat/SKILL.md) và làm đúng các lệnh trong đó. Không drive nhầm DB đang dùng cho điện thoại.

Tunnel ra điện thoại là `cloudflared tunnel --url http://127.0.0.1:<cổng>` trỏ vào server đã đặt `HNG_ORIGIN` bằng URL https của tunnel. Link chết khi máy tắt. Không ghi URL tunnel hay PIN vào git.

## Quyết định đã chốt

- Đếm ngược vote (ô giây lúc kê bàn) **không** tự đóng vote và **không** bắt buộc hiện đồng hồ trên bàn. Muốn khóa quán thì có người bấm Chốt.
- Mọi người đang tham gia (dân đen, nô lệ, và các tầng trên) đều bấm được **Chốt quán này**. Bấm xong, quán đó có tem CHỐT và thực đơn gọi món là thực đơn quán đó. Máy khác thấy qua WebSocket, không cần tải lại.
- Vòng quay giữ giảm tốc. Tên kết quả (thẻ TRỜI ĐÃ ĐỊNH và dòng ĐÃ QUAY) chỉ hiện khi đĩa đã dừng, và trùng ô dưới kim.
- Chia tiền theo bội 500đ. Phần lẻ 0–499đ do chủ xị gánh. VietQR chỉ khi chủ xị đã có số tài khoản.
- Ảnh bill/menu cần `HNG_AI_KEY`. Không có key thì AI tắt, các màn khác vẫn chạy.
