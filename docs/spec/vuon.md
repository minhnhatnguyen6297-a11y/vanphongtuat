# Vườn

Mini-game trong app, để ngồi thư giãn. Nuôi thú và trồng cây. Không có tiền, cửa hàng, đấu, chết, thua, phạt khi vắng mặt, bảng xếp hạng, hay thông báo đẩy.

Vào từ ô **VƯỜN** trên `#/sanh`, mục Vườn trên rail, hoặc `#/vuon`.

Phong cách tranh và cách thêm loài: [vuon-design.md](vuon-design.md).

## Hai việc

**Cho ăn** cho thú đang chọn. **Tưới cây** cho cây đang chọn. Ghé vườn đồng nghiệp thì chỉ tưới giúp cây của họ.

## Vì sao chỉ hai việc

Vườn là chỗ nghỉ, không phải game thứ hai. Thêm nhiệm vụ, phần thưởng hay hình phạt sẽ biến nó thành việc phải làm.

## Ngày chăm

Mỗi loài, mỗi ngày lịch `Asia/Saigon`, chỉ tính một lần. Bấm thêm trong ngày vẫn được, thú vẫn no, cây vẫn mát, nhưng số ngày không tăng. Ngày hôm sau mới tăng một.

Ngưỡng chỉ sửa ở `VUON_GROWTH` trong `app/src/shared/vuon.ts`:

- 7 ngày chăm → Trưởng thành
- 21 ngày chăm tổng → Thần thoại

Cấp không bao giờ giảm. Vắng một tuần không đói thành buồn, không chết, không mất cấp.

## Vì sao một lần một ngày

Bấm liên tục không được thưởng. Người bận vẫn tiến như người ngồi cả buổi. Máy chủ giữ số này, không phải trình duyệt.

## Vì sao không lùi

Vắng mặt không phải lỗi. Câu chữ khi chưa cho ăn là «Hơi đói», vẫn ngoan, không trách.

## Cấp Thần thoại

Hình lớn, trấn một góc vườn. Mỗi loài một tính cách, không phải một khuôn cánh và kim tuyến. Sung ở cấp này tên là **Cây thế giới**.

Bấm một ô cấp trên tấm giấy là **xem tranh**. Cấp thật không đổi. Biển «Đang xem tranh» hiện khi tranh đang xem khác cấp thật.

## Vì sao xem tranh không tăng cấp

Người muốn thấy thần hộ mệnh không phải chờ 21 ngày, và cũng không bịa cấp.

## Mùa và đêm

Mùa thật theo khí hậu miền Bắc, múi giờ Sài Gòn: xuân tháng 2–4, hạ 5–7, thu 8–10, đông 11, 12 và 1. Nút Xuân / Hạ / Thu / Đông góc phải chỉ để xem trước. Bấm lại mùa đang diễn thì trở về lịch.

Đêm là trước 6:00 và từ 18:00. Đêm thì thú buồn ngủ, vườn tối nhẹ. Không khóa nút chăm.

## Vì sao cả phòng một lịch

Ngày chăm phải trùng nhau. UTC lệch một buổi tối sẽ tính hai ngày khác nhau cho hai máy.

## Biểu cảm

Vui, buồn ngủ, hơi đói, được vuốt ve (chạm thú), ngạc nhiên (vừa vào, hoặc đổi mùa xem trước), mãn nguyện sau khi ăn. Nhãn chữ, không vẽ mặt bằng CSS.

## Ghé vườn

Chọn đồng nghiệp, tưới một cây của họ. Lần tưới đó tính vào vườn họ, vẫn một lần một ngày. Không cho ăn hộ thú. Không điểm, không so.

## Vì sao màn không vẽ lại cả trang

WebSocket của app gọi vẽ lại toàn bộ khi có tin. Vườn đang có gió và ánh sáng. Khi đã đứng ở `#/vuon`, tin mới chỉ cập nhật chữ và tranh, không dựng lại khung. Cùng cách `#/typhu` giữ bàn cờ.

## Tranh

Nền theo mùa, sprite từng cấp. CSS chỉ làm gió (lắc, cánh hoa, lá, tuyết) và ánh sáng (tia, hào quang theo tính cách). Loài chưa có đủ ba file thì hiện «Chưa có tranh».

Tám loài đã có tranh: mèo, corgi, thỏ, cá koi, sen, mai, tre, sung. Mười sáu loài còn lại nằm trong danh mục, `art: false`, tính cách đã gán sẵn trong code.
