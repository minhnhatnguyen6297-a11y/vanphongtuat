# Vườn

Người đăng nhập, mở `#/vuon` từ ô VƯỜN trên sảnh, bấm Cho ăn và Tưới cây, thấy câu kết quả.

## Sub-features

- `open` vào `#/vuon`, thấy cấp Non.
- `feed` hiện «Đã cho ăn» và «Mãn nguyện».
- `feed-cap` lần cho ăn thứ hai trong ngày hiện «Hôm nay đã no rồi», vẫn «1 ngày chăm».
- `water` hiện «Đã tưới» và tên Sen.

## How to get to it (user POV)

- Sau đăng nhập, `#/sanh`, ô `a.hn-vuon-tile`.
- Hoặc rail «Vườn», hoặc hash `#/vuon`.

## Driving it with Playwright

Preconditions:

- Doctor và launch của skill này, nếu skill đã có trên máy. Không có thì `cd app && npm run build` rồi e2e riêng: `npm run e2e`.
- PIN chỉ đọc từ file pin của lần chạy, không ghi vào repo.

- **Vào.** Đăng nhập Minh. Mở `#/sanh`. Bấm ô VƯỜN.
- **Cho ăn.** Nút «Cho ăn». `[data-vuon-status]` chứa «Đã cho ăn». `[data-expression]` là `man_nguyen`. Nhãn «Mãn nguyện». «1 ngày chăm».
- **Lần nữa.** Cùng nút. Status «Hôm nay đã no rồi». Vẫn «1 ngày chăm».
- **Tưới.** Nút «Tưới cây». Status «Đã tưới». Biển tên Sen.

## Gotchas

- WebSocket không được dựng lại cả `#/vuon`. Nếu `[data-vuon-root]` biến mất sau một cú bấm, là lỗi.
- `prefers-reduced-motion` tắt gió. E2E vườn để `no-preference` nếu cần xem lắc; ca này không đo gió.
- Xem tranh Thần thoại (bấm ô cấp trên Kho) không đổi «Cấp độ» thật. Biển «Đang xem tranh» là xem, không phải đã đạt.
