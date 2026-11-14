# Kê bàn và vote quán

Từ sảnh hoặc rail «Bàn hôm nay», mọi người thấy các quán của bàn hiện tại, phần trăm phiếu, và thực đơn quán đang được gọi.

Kê bàn mới: chọn quán, có ô «Đếm ngược vote (giây, 0 = tắt)», rồi KÊ BÀN.

## Đếm ngược không tự đóng

Ô giây là ghi chú thời gian người kê bàn muốn. **Hết giờ không tự khóa quán, và màn vote không bắt buộc hiện đồng hồ.** Chủ muốn vote chỉ kết thúc khi có người bấm Chốt, để bàn còn đổi ý được. Không thêm tự động chốt khi hết giờ.

## Ai cũng bấm được Chốt

Nút **Chốt quán này** hiện trên từng quán khi bàn chưa khóa, với mọi người đang tham gia (dân đen, nô lệ, phó xị, chủ xị). Không chỉ chủ xị.

Bấm Chốt một quán thì:

- Quán đó có tem CHỐT.
- Thực đơn phía dưới đổi thành món của quán đó. Đây là cách chọn quán để gọi món.
- Máy khác đang mở bàn thấy tem và thực đơn mới qua WebSocket, không cần tải lại.

Trước khi có người chốt, thực đơn có thể đang hiện một quán (quán dẫn đầu hoặc quán mặc định). Đó chưa phải kết quả. Kết quả là lúc có tem CHỐT.

## Vì sao ai cũng chốt được

Bữa trưa không chờ một người có quyền. Ai ngồi bàn cũng có thể khóa quán cả nhóm vừa chọn. Quyền «Chốt quán» trong ma trận mặc định bật cho mọi tầng. Chủ xị vẫn sửa được ma trận sau này nếu muốn thu hẹp, nhưng mặc định là mở.
