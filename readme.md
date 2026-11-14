# Hôm Nay Ăn Gì?

App vui để cả văn phòng chọn quán ăn trưa, gọi món, quay người đi lấy, và chia tiền. Chạy trên máy trong mạng nội bộ: Node.js, SQLite một file, WebSocket. Giao diện là Văn Phòng Tuất (neo-brutalism, chữ Việt).

Không sổ nợ, không chốt sổ kế toán, không theo dõi đã trả hay chưa trả.

## Chạy dev

Cần Node.js 22 trở lên.

```bash
cd app
npm ci
npm run build
HNG_DEV_HTTP=1 HNG_ORIGIN=http://127.0.0.1:8443 npm run dev
```

Mở `http://127.0.0.1:8443`. DB trống thì server tự tạo dữ liệu giả và in PIN một lần ra console. Không commit PIN, `.env`, hay `app/data/`.

`npm run dev` chỉ theo dõi server. Sửa file trong `src/client/` thì chạy lại `npm run build`.

HTTPS cho máy văn phòng (chứng chỉ nội bộ) nằm ở [`app/docs/VAN-HANH.md`](app/docs/VAN-HANH.md).

## Test

```bash
cd app
npm test          # unit và server
npm run e2e       # trình duyệt, tự bật một server riêng
```

Muốn một agent bấm app và giữ bằng chứng: [`.cursor/skills/verify-vanphongtuat/SKILL.md`](.cursor/skills/verify-vanphongtuat/SKILL.md).

## Điện thoại tạm

Khi server đang nghe HTTP ở máy này, có thể mở tunnel không tài khoản:

```bash
cloudflared tunnel --url http://127.0.0.1:8443
```

Đặt `HNG_ORIGIN` bằng URL `https://….trycloudflare.com` rồi khởi động lại server, nếu không đăng nhập bị từ chối. Link chỉ sống khi process tunnel và máy còn chạy.

## Bố cục

| Thư mục | Nội dung |
|---|---|
| `app/` | Mã chạy được: server, client, migration, test |
| `docs/spec/` | Spec từng màn, gồm lý do các quyết định không hiển nhiên |
| `docs/qa/` | Quy chuẩn test và báo cáo đã bấm |
| `design-toi-gian/` | Thiết kế màn và mock |
| `archive/` | Bản thiết kế cũ, không sửa |
| `agents.md` | Quy chuẩn giao diện và kiến trúc |
| `AGENTS.md` | Việc agent cần biết trước khi sửa |

## Phạm vi

Bàn (vote, chốt quán, gọi món), vòng quay, tính tiền và VietQR, sổ ghi, kho quán. Chat, sảnh game, và phân quyền đã có trong mã. AI đọc ảnh chỉ khi có `HNG_AI_KEY`.
