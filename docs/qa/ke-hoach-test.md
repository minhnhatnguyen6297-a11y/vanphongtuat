# Kế hoạch test khám phá — Hôm Nay Ăn Gì?

Bám `docs/qa/quy-chuan-test.md`. Không sửa code app trong lượt này. Dữ liệu chỉ là seed giả.

## Môi trường

- App local riêng, không đụng DB đang mở trên tunnel điện thoại.
- Cổng `8455`, `HNG_DEV_HTTP=1`, origin `http://127.0.0.1:8455`, DB `app/data/qa-e2e.db` (không commit).
- Desktop ~1366×768 và khung điện thoại 390×844.
- Tài khoản seed in ra log server lần đầu. Dùng nhiều cửa sổ / context, mỗi cửa một người (Minh, Lan, Tuấn…).
- Tối đa **3 vòng**. Mỗi vòng tối đa **4** người test song song, mỗi người khoảng **40** thao tác trình duyệt. Hết một vòng mà không có lỗi High/Critical mới thì dừng.

## Charter

Mỗi dòng là một phiên. Trong phiên: đi happy path, rồi biên, F5, Back, bấm đúp, dữ liệu rỗng hoặc tên rất dài, và (nơi ghi) hai người cùng lúc.

| ID | Màn / việc | Charter | Kịch bản bắt buộc |
|---|---|---|---|
| C1 | Đăng nhập | Vào được, sai thì bị chặn, thoát được | PIN đúng 6 số; PIN 5 số; PIN sai; để trống; F5 khi đang gõ; đăng xuất rồi vào lại; Back sau khi vào |
| C2 | Sảnh | Từ sảnh nhảy đúng màn, trạng thái “tôi là ai” rõ | Bấm từng thẻ: bàn, vòng quay, tính tiền, sổ, kho, game, quyền, chat. Khung 390px: thẻ có bị cắt không |
| C3 | Bàn — mở vote | Một người tạo được cuộc chọn quán | Bàn đang có: đọc được quán và %. Bấm kê bàn mới, chọn 1 quán, chọn 0 quán. F5 giữa chừng |
| C4 | Bàn — vote quán | Nhiều người vote, ai cũng thấy % đổi | Minh vote quán A, Lan (context khác) thấy % đổi không cần F5. Bấm đúp vote. Vote rồi F5 |
| C5 | Bàn — chốt quán | Mọi người tham gia thấy nút Chốt quán này. Bấm thì khóa quán đó và mở thực đơn quán đó. Đếm ngược không tự khóa | Lan bấm Chốt. Minh thấy tem CHỐT và thực đơn đổi không cần F5. Kê bàn với đếm ngược 2 giây, đợi quá 2 giây: vẫn chưa có tem CHỐT |
| C6 | Bàn — gọi món | Gọi món xong thì dòng hiện ở bill, người kia thấy | Gọi từ thực đơn; gọi ô trống; gọi tên món rất dài; bấm đúp GỌI; F5; Lan thấy món Minh vừa gọi |
| C7 | Vòng quay | Quay nhiều lần, kim và kết quả khớp, chuyển động có giảm tốc | Nhìn viền ô / màu. Quay ≥ 5 lần. Kết quả có hiện trước khi vòng dừng không. Ô dưới kim có đúng tên vừa công bố không. Sau quay, nút “chốt quán này” / “ghi người đi lấy” có gắn đúng kết quả không. F5 lúc đang quay. Bấm đúp QUAY |
| C8 | Tính tiền + VietQR | Chia tiền ra số đúng kiểu, QR chỉ hiện khi có STK | THEO MÓN và CHIA ĐỀU. Tổng 0. Chưa có STK thì QR thế nào. Thêm STK rồi xem QR có số tiền và nội dung không. Ảnh AI khi không có key |
| C9 | Sổ ghi | Xem lại bàn cũ, mở một dòng, kê lại được | Mở bàn cũ. F5. Bấm kê lại nếu có |
| C10 | Kho quán | Thêm, sửa, xóa quán và món | Tên rỗng; tên rất dài; thêm món giá 0 và giá lẻ; xóa quán; thêm quán từ kho vào bàn đang mở |
| C11 | Sảnh game | Vào phòng, chơi một nước, người kia thấy | Mở Caro hoặc game đang hiện. Hai người. F5 giữa ván. Back |
| C12 | Quyền / admin | Chủ xị thấy việc quản trị; người thường không sửa ma trận | Minh mở Quyền. Lan chốt quán được. Lan không xóa quán của người khác nếu không đủ quyền, không sửa ma trận |
| C13 | Chat + realtime | Tin nhắn tới người cùng bàn, không cần F5 | Minh gửi một câu ở chat bàn. Lan đang đứng bàn đó có thấy không. F5. Chuỗi rất dài |
| C14 | Điện thoại 390px | Luồng bàn và vòng quay bấm được bằng ngón tay | 390px: login, bàn, vòng quay. Nút có bị khuất dưới rail không |

## Cách ghi trong vòng test

- Lỗi lặp lại được: đủ bước, kỳ vọng, thực tế, ảnh.
- Chỗ chưa chắc: ghi “chưa rõ”, test lại ở vòng sau, không bịa.
- Hết vòng không có High/Critical **mới**: dừng, viết `docs/qa/bao-cao-e2e.md`.
