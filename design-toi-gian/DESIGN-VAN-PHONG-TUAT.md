# Văn phòng Tuất

Bản đề xuất giao diện desktop cho **Hôm nay ăn gì?**. Ảnh mẫu định hình chất minh họa, bảng màu và cách dựng mảng. Luồng sử dụng bám theo app nội bộ chạy trên LAN, với khung tham chiếu 1366 × 768 px.

## Ngôn ngữ hình ảnh

- **Mặt bàn văn phòng.** Nền kem ấm, phiếu giấy ngà và đường viền mực đậm. Kẹp giấy, mép gập, vệt bút dạ và dấu đóng tạo điểm nhấn ở tiêu đề hoặc góc khung.
- **Shiba đeo cà vạt đỏ.** Nhân vật xuất hiện rõ ở màn đăng nhập, như một tấm Polaroid dán trên bàn. Khi đã vào app, thu nhỏ thành dấu chân hoặc sticker ở mép khung, chừa chỗ cho dữ liệu và thao tác.
- **Sticker thương hiệu.** Chữ “Văn phòng Tuất” đậm, viền mực, có lớp đệm giấy sáng. Bản lớn có hai dòng và mảng vàng như ảnh mẫu. Bản thu gọn đặt trên thanh đầu trang, kèm tên app “Hôm nay ăn gì?”.
- **Chất in truyện tranh.** Bóng cứng đổ xuống phải. Chất giấy hạt nhẹ dành cho phần minh họa. Dữ liệu, biểu mẫu và vùng nhập dùng nền phẳng để giữ chữ sắc và dễ đọc.

## Bảng màu

Các giá trị dưới đây chuẩn hóa từ ảnh mẫu. Màu đỏ đậm giữ vai trò cảnh báo và là phương án nền cho chữ sáng cỡ nhỏ.

| Token | Hex | Cách dùng |
|---|---|---|
| `desk` | `#FEECD6` | Nền workspace và vùng quanh phiếu đăng nhập |
| `paper` | `#FDF7EB` | Phiếu order, biểu mẫu, danh sách, ô chưa chọn |
| `ink` | `#13110F` | Chữ chính, đường viền, icon, bóng cứng |
| `marker` | `#FFDA2E` | Vệt tiêu đề, lựa chọn hiện tại, tem **DẪN ĐẦU** |
| `highlight` | `#FDE67F` | Nền vàng nhẹ cho dòng của mình hoặc ghi chú |
| `stamp` | `#EF3C35` | Nút chính **VÀO SẢNH**, **GỌI**, **QUAY LẠI** với chữ mực |
| `stamp-dark` | `#C62828` | Lỗi và cảnh báo trên giấy, hoặc nền nút có chữ giấy ngà |
| `binder` | `#145C34` | Thanh đầu trang, tem **CHỐT**, nút xác nhận với chữ giấy ngà |
| `link-blue` | `#1D63E1` | Thao tác phụ như sao chép, liên kết và vòng focus |
| `desk-edge` | `#F7B280` | Cạnh bàn và phụ kiện trong minh họa |

Các cặp chữ/nền đạt từ 4,5:1 với token trên gồm mực/đỏ (4,82:1), mực/vàng (13,74:1), giấy/xanh lá (7,54:1), giấy/xanh dương (5,02:1) và giấy/đỏ đậm (5,27:1).

## Chữ và kích thước

| Vai trò | Font và thông số desktop |
|---|---|
| Thương hiệu, tiêu đề màn | Bungee 32–44 px, line-height 1,1. Chữ mực trên vệt vàng, hoặc chữ giấy viền mực trên dấu đỏ ở đăng nhập. |
| Tiêu đề khung | Bungee 16–20 px. Giữ chữ thẳng để đọc nhanh khi có nhiều khung. |
| Nhãn, nút và nội dung | Be Vietnam Pro 14–16 px, line-height 1,4–1,5. Dùng 700–800 cho nhãn, 500–600 cho nội dung. |
| Giá, tỷ lệ, PIN, mã bàn | JetBrains Mono 13–16 px. Tổng bill 28–32 px. Căn phải giá trong danh sách. |

Dùng font WOFF2 local sẵn trong app. Nhịp giãn cách 4, 8, 12, 16 và 24 px. Khung chính có viền 3 px và bóng `5px 5px 0 #13110F`. Ô nhập và chip dùng viền 2 px, bo 6–8 px. Nút chính cao 44–48 px. Góc gập và góc vát dùng ở phiếu hoặc nút chính.

## Khung ứng dụng và trạng thái

- **Đăng nhập** dùng bố cục riêng. Logo nổi trên phiếu. Shiba, bìa hồ sơ và con dấu nằm ngoài vùng nhập liệu.
- **Sau đăng nhập**, thanh đầu xanh lá đậm có logo gọn và tài khoản. Nội dung chia thành vùng làm việc và rail bên phải rộng 60–62 px. Sáu điểm đến theo thứ tự Bàn, Quay, Tính tiền, Sổ ghi, Kho quán, Sảnh. Màn hiện tại có nền vàng và tên truy cập của mục điều hướng.
- **Phiếu** dùng nền ngà, tiêu đề và thao tác phụ ở hàng đầu, số liệu chính nằm trong luồng đọc. Mỗi vùng có một điểm nhấn màu. Ưu tiên thấy thao tác chính ở 1366 × 768, với danh sách dài cuộn trong vùng phù hợp.
- **Nút** có chữ và icon khi icon giúp nhận diện. Khi nhấn, dịch 2 px xuống phải và giảm bóng. Focus bàn phím có vòng xanh 2 px, cách viền 3 px. Trạng thái chọn thêm dấu tick hoặc nhãn, đi kèm trạng thái truy cập tương ứng.
- **Tem trạng thái** vàng + **DẪN ĐẦU**, xanh lá + **CHỐT**, đỏ đậm + nhãn cụ thể cho lỗi. Nút đang xử lý giữ nguyên kích thước và đổi nhãn theo hành động, ví dụ **ĐANG QUAY…**.

## Áp dụng theo màn

| Màn | Bố cục và cách phối màu |
|---|---|
| **Đăng nhập** | Phiếu giấy gập góc, tiêu đề **ĐĂNG NHẬP** trên vệt đỏ. Chọn thành viên bằng lưới tên, người được chọn có nền vàng và dấu tick. Ô **PIN 6 số** nằm ngay trước nút đỏ **VÀO SẢNH**. Giữ chỗ cho danh sách thành viên thực tế. |
| **Bàn hôm nay** | **VOTE QUÁN** bên trái, **GỌI MÓN** bên phải, **THỰC ĐƠN** và ô ghi chú ở dưới. Vàng đánh dấu quán dẫn đầu và lựa chọn hiện tại. Dòng order của mình dùng vàng nhạt. Giá canh phải. Nút **GỌI** đỏ. |
| **Vòng quay** | Đĩa quay nhiều màu ở trái, danh sách ô và trọng số ở phải. Tên và màu từng ô khớp với đĩa, góc từng miếng tỷ lệ với trọng số. Sau lượt quay, kết quả nằm trong phiếu **TRỜI ĐÃ ĐỊNH**, có nút xác nhận riêng theo loại vòng và quyền. |
| **Tính tiền** | Phiếu bill bên trái, danh sách phần trả bên phải. **THEO MÓN / CHIA ĐỀU** dùng nền vàng cho chế độ hiện tại. Số tiền căn phải. QR và nội dung chuyển khoản nằm cùng phiếu của người đang chọn. Nhãn **Chủ xị gánh lẻ** cạnh dòng tổng khi có phần lẻ. |
| **Sổ ghi** | Dòng bàn theo dạng phiếu hồ sơ, mỗi dòng có mã bàn, ngày, quán, số người và tổng tiền. Dòng đang mở dùng nền vàng nhạt, có chi tiết và nút **KÊ LẠI BÀN NÀY**. |
| **Kho quán** | Khung nhập bên trái, danh sách quán bên phải. Nhãn loại và viền màu giúp quét nhanh. Dữ liệu nhận từ link hoặc ảnh nằm trong ô để soát trước khi bấm **LƯU VÀO KHO**. |
| **Sảnh và Quyền** | Sảnh dùng thẻ giấy cho lối vào và phòng chơi. Màn Quyền dùng bảng nền ngà, hàng tiêu đề xanh lá đậm. Dùng nhãn văn bản cho cấp quyền và trạng thái yêu cầu. |

## Mockup desktop

Các ảnh dùng tên, quán, số tiền và mã QR minh họa. Thiết kế đăng nhập lấy bố cục từ ảnh mẫu và dùng luồng chọn thành viên, nhập PIN của app.

1. [Đăng nhập](van-phong-tuat/01-dang-nhap.png)
2. [Bàn hôm nay](van-phong-tuat/02-ban-hom-nay.png)
3. [Vòng quay](van-phong-tuat/03-vong-quay.png)
4. [Tính tiền](van-phong-tuat/04-tinh-tien.png)
