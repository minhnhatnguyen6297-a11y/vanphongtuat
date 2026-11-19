# Báo cáo dùng thử — Hôm Nay Ăn Gì?

Đã ngồi bấm trên Chrome thật, hai vòng. Vòng 1: bốn phiên song song (đăng nhập, bàn, vòng quay, tính tiền/kho). Vòng 2: kiểm lại chỗ chưa chắc. Vòng 2 không ra thêm lỗi High mới, nên dừng, không có vòng 3. Không sửa code app.

Dữ liệu chỉ là seed giả, mỗi phiên một DB riêng. Tunnel điện thoại cổng 8443 không bị đụng.

Chạy lại phần tự động: trong `app/`, `npm run e2e`. Bảy ca vui phải xanh. Ba ca `QA-01`, `QA-02`, `QA-03` được đánh dấu expected-fail: suite vẫn xanh khi lỗi còn đó, và sẽ đỏ nếu lỗi hết mà quên gỡ dấu.

## Số liệu

| Mức | Số |
|---|---|
| Critical | 0 |
| High | 3 |
| Medium | 0 |
| Low | 0 |

| Loại | Số |
|---|---|
| Lỗi code | 2 (QA-01, QA-03) |
| Lỗi logic thiết kế | 1 (QA-02) |
| Lỗi UX-giao diện | 0 |
| Lỗi hiệu năng | 0 |

## Bảng lỗi

| ID | Màn | Loại | Mức | Các bước | Kỳ vọng | Thực tế | Bằng chứng |
|---|---|---|---|---|---|---|---|
| QA-01 | Bàn — kê bàn | Lỗi code | High | Đăng nhập Minh. Bàn hôm nay → KÊ BÀN MỚI. Ô «Đếm ngược vote» đang là 0. Gõ `8`, bấm KÊ BÀN. Đợi hơn 8 giây trên bàn mới. | Có đồng hồ đếm, hết giờ thì quán bị khóa (tem CHỐT) hoặc không còn nút Chốt. | Bàn mới mở (#7, 14/11), không có chữ đếm giờ. Sau 8 giây vẫn 0 phiếu, vẫn ba nút Chốt, không tem CHỐT. | [Hộp kê bàn](evidence/qa01-dem-nguoc.png), [sau 8 giây](evidence/qa01-het-gio.png). `npm run e2e` ca QA-01. |
| QA-02 | Bàn — vote | Lỗi logic thiết kế | High | Một context Minh, một context Lan, cùng `#/ban`. Tìm cách kết thúc vote. | Người đang vote thấy một bước kết thúc rõ: đóng vote, khóa một quán, rồi thực đơn quán đó là bước tiếp. | Lan (dân đen) không có nút Chốt, không có nút đóng vote. Minh có nút Chốt nhỏ trên từng quán. Bấm Chốt quán không dẫn đầu thì tem CHỐT hiện và thực đơn đổi đúng quán đó. Thực đơn đã hiện từ trước khi có ai chốt, nên cuộc vote trông như không có hồi kết với người không phải chủ xị. | [Lan](evidence/qa02-lan.png), [Minh](evidence/qa02-minh.png), [chốt đổi menu](evidence/qa02-chot-doi-menu.png). Ca QA-02. |
| QA-03 | Vòng quay | Lỗi code | High | Minh mở Vòng quay, bấm QUAY NGAY. Khoảng 0,4 giây sau, khi nút còn «ĐANG QUAY…», đọc mục ĐÃ QUAY và nhìn kim. | Tên kết quả chỉ xuất hiện khi đĩa đã dừng, và trùng ô dưới kim. | Thẻ «TRỜI ĐÃ ĐỊNH» chưa hiện (đúng). Mục ĐÃ QUAY đã ghi «Hương Kế Toán» trong lúc nút vẫn là ĐANG QUAY và kim chưa nằm ở ô đó. Khi đĩa dừng, tên trên thẻ khớp ô dưới kim (5/5 lần ở vòng 1). Đĩa có giảm tốc: nửa đầu quay nhanh hơn nửa cuối (đo `--wheel-angle`). | [Đang quay mà nhật ký đã có tên](evidence/qa03-dang-quay.png). Ca QA-03. |

## Năm việc sửa trước

Chỉ có ba lỗi High. Sửa theo thứ tự này:

1. **QA-03** — Đừng ghi ĐÃ QUAY và đừng lộ tên khi đĩa còn chạy. Người xem biết trước kết quả thì vòng quay mất nghĩa.
2. **QA-01** — Ô đếm ngược hoặc là đếm thật trên màn bàn và hết giờ thì khóa quán dẫn đầu, hoặc bỏ ô đó đi kẻo người dùng tưởng vote sẽ tự đóng.
3. **QA-02** — Trên vote, một câu rõ «Chủ xị bấm Chốt để khóa quán» nếu người xem không có quyền. Nút kết thúc nên là một việc, không phải chữ Chốt nhỏ trên từng thẻ. Dân đen được kê bàn nhưng không được kết thúc: hoặc cho người kê bàn bấm chốt, hoặc nói ngay lúc kê bàn rằng chỉ chủ xị khóa được.

Gợi ý cho lỗ QA-02: hết giờ (QA-01) thì tự chốt quán đang dẫn đầu, hiện tem CHỐT, và thực đơn phía dưới đổi thành quán đó, không gọi món quán khác được nữa. Trước khi khóa, ghi một dòng trạng thái «Đang vote — chưa chốt».

## Đã bấm và không thấy gãy

- Đăng nhập PIN đúng vào sảnh «CHÀO MINH!». PIN `000000` và PIN 5 số ở lại màn đăng nhập, có chữ Sai PIN / PIN 6 số.
- F5 sau khi vào vẫn còn phiên. Đăng xuất về lại roster.
- Khung 390px: sảnh và bàn không tràn ngang.
- Lan vote, phần trăm trên màn Minh đổi không cần F5.
- Minh chốt quán không dẫn đầu: tem CHỐT, tên quán đang gọi và thực đơn đổi (cơm tấm → bún đậu).
- Gọi một món trên thực đơn: dòng mới mang tên Minh, Lan thấy không cần F5. GỌI khi chưa chọn món thì toast «Gõ món hoặc chọn thực đơn».
- Vòng quay: thẻ kết quả không hiện trong lúc ĐANG QUAY. Sau khi dừng, tên khớp ô gần kim nhất, 5 lần. Có giảm tốc.
- CHIA ĐỀU, bill = 10.000đ × số người: mỗi người 10.000đ. THEO MÓN với bánh mì 25k và 30k, bill 100.000đ: 45.500đ và 54.500đ (bội 500, cộng lại đúng bill).
- Chưa có STK thì có nút Thêm STK, không có mã VietQR.
- Kho: tên trống thì «Thiếu tên quán». Tên dài 81 ký tự thì «Đã lưu».
- Sổ ghi và sảnh game mở được. Chưa đánh một ván game nên không kết luận luật chơi.

## Việc không làm

Không có lỗi Critical. Không đụng mạng chậm / offline. Không sửa code sản phẩm trong lượt này.
