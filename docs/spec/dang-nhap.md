# Đăng nhập PIN

Người chọn tên trên thẻ, gõ PIN 6 số, bấm VÀO SẢNH. Đúng thì vào sảnh, chào bằng tên hiển thị. Sai thì ở lại màn đăng nhập và thấy chữ báo sai. Đăng xuất ở avatar đưa về roster.

## Vì sao

Văn phòng nhỏ, không email, không mật khẩu dài. PIN ngắn đủ để khỏi bấm nhầm vào tài khoản người khác. PIN seed là số ngẫu nhiên in một lần ra console, không ghi vào git.

Cookie phiên là HttpOnly. Trên HTTP dev (`HNG_DEV_HTTP=1`) cookie không gắn cờ Secure. Origin của request phải trùng `HNG_ORIGIN`, nếu không máy chủ từ chối đăng nhập. Vì vậy mở `127.0.0.1` thì biến môi trường cũng phải là `127.0.0.1`, không phải `localhost`.
