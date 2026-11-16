# Drawquarium văn phòng

Phòng `#/chat` là một bể cá chung, sát vòng chơi Drawquarium, cộng thêm một khung chat. Chat không điều khiển cá. Bản này là prototype máy tính để bàn cho máy văn phòng yếu. Không làm bản điện thoại.

## Vì sao chia việc này

Máy đích (DxDiag 12/11/2026) là Pentium Gold G6405, 2 lõi / 4 luồng, 8 GB RAM, Intel UHD 610. Cùng một máy chạy Node (MAY3) cho 6–15 người và mở trình duyệt. Vẽ lại nét cá mỗi khung, hoặc nướng sprite trên CPU máy chủ, đều lấy đúng phần máy đang phải phục vụ vote, chat và SQLite.

Cách làm:

1. **Người vẽ nướng một lần.** Lúc bấm thả, trình duyệt đã có canvas. Nó xuất một PNG 192×96 (đuôi – thân – đầu nằm ngang) rồi `POST /api/be/sprite`.
2. **Máy chủ không giải nén ảnh.** Chỉ đọc IHDR cho đúng 192×96, SHA-256 nguyên byte, ghi file nếu chưa có. Pentium chỉ băm và ghi đĩa, cỡ vài chục kilobyte mỗi con.
3. **Người khác chỉ tải ảnh đã xong.** URL `/art/be/s/<hash>.png` kèm `Cache-Control: public, max-age=31536000, immutable`. Con cá cũ không tải lại. Không ghép atlas trên máy chủ: mỗi con mới sẽ phải vẽ lại cả tập và làm hỏng cache của mọi người.
4. **Nền bể nướng lúc build** (`npx tsx scripts/gen-be-art.ts`): phòng, nước, vân sáng, tia sáng, tảo, cát, đá, gỗ, bọt. Tên file có hash. `manifest.json` thì `no-cache` để lần phát hành sau trỏ sang file mới. Mỗi lớp nền dưới 300 KB; cả bộ khoảng 0,4 MB.

Nét vector (tối đa 8 KB sau khi rút điểm) vẫn là bản để sửa. Ảnh chỉ để bơi. Không vẽ lại từng nét mỗi khung.

## Vì sao Canvas 2D, 30 khung, và tự hạ mức

UHD 610 chạy WebGL bộ lọc nước dễ nóng và lệch driver. Canvas 2D đủ để ghép ảnh đã nướng. Trần 30 khung/giây, không chạy 60. `devicePixelRatio` mức Cao tối đa 1,5 và bề ngang canvas không quá 1600 px. Tab ẩn thì hủy `requestAnimationFrame` ngay.

Mức, bắt đầu ở **Vừa**:

| Mức | Khung | Nét | Việc vẽ |
|---|---|---|---|
| Cao | 30 | tới 1,5 | vân nước, tia sáng, bọt, thân cá 3 khúc |
| Vừa | 30 | 1,0 | vân nhạt hơn, ít bọt, vẫn uốn 3 khúc |
| Nhẹ | 15 | 0,62 rồi phóng | tắt vân, tia, bọt; cá một ảnh, không uốn khúc |
| Tĩnh | một khung | 1,0 | khi hệ thống xin ít chuyển động |

Máy báo `deviceMemory <= 4` không lên Cao. Dưới 24 khung trong 5 giây thì xuống một mức. Đo xong xóa cửa sổ mẫu để khung nhanh lúc vừa mở trang không giữ mức sai.

Bể chung của 15 người không cắt cá ở mốc 6–10 của game gốc. Game gốc là một người, trần khoảng 10 con. Ở đây trần **40 cá**, 24 cây, 16 đồ — nếu giấu cá của đồng nghiệp thì bể hết nghĩa. Máy yếu thì hạ hiệu ứng, không giấu cá.

Cảnh bể là một canvas cố định. Tin chat và tin bể không dựng lại cả trang, để khỏi mất khung hình. Cùng hướng với màn Tỉ phú / Vườn, nhưng không đụng nhánh Vườn.

## Vì sao đá khi vắng

Luật này không có trong Drawquarium. Máy yếu không nên vẽ bể cả ngày.

- Tab đang mở, không đụng gì: **15 phút**.
- Tab ẩn: **5 phút**. Ẩn tab thì dừng vẽ ngay, không đợi hết giờ.
- Báo trước **1 phút**: «Sắp rời bể vì vắng.» Nút «Tôi vẫn ở đây».
- Hết giờ: dừng vẽ, xóa ảnh trong bộ nhớ, đóng WebSocket, không tự nối lại. Câu trên màn: «Bạn đã rời bể vì vắng lâu — tải lại trang để vào lại». Nút «Vào lại» tải lại cả trang.
- Tính là có mặt: chuột, phím, lăn, vẽ, cho ăn, hút, kéo cá, gửi tin của mình, nút ở lại.
- Không tính: cá tự bơi, nước chuyển, tin của người khác. Nếu tin người khác cũng gia hạn thì phòng đông không bao giờ đá, máy vẫn nặng.

Ba mốc chỉnh bằng `HNG_BE_IDLE_VISIBLE_MS`, `HNG_BE_IDLE_HIDDEN_MS`, `HNG_BE_IDLE_WARN_MS`. Test để ngắn.

Phiên ở trong RAM của tiến trình, không ghi SQLite mỗi nhịp. Nhịp sống gửi khi có hoạt động, không gửi liên tục, và không quá một lần mỗi 15 giây. Cá, cây, vảy nằm trong SQLite, không mất khi người rời.

## Chat đứng riêng

Khung chat là phòng `lobby` sẵn có, đặt bên phải bể. Gửi tin không làm cá lại gần, không thả mồi, không gắn avatar. Cho ăn vẫn là nút của bể.

## Vòng chơi bản này có

Vẽ cá, cây, mồi, đồ. Bút, tẩy, kẻ thẳng, tô, tem mắt, lật, đối xứng, nét mượt, hoàn / làm lại, bảng màu, lấy màu. Ba bước: vẽ hình, tô, cách bơi. Bốn cách bơi. Thân uốn 3 khúc khi mức còn Vừa trở lên. Cho ăn, cá lớn dần, mồi thừa phải hút. Hút cặn. Kéo cá, bấm nước cho cá lại gần, giữ kính cho cá giật. Sửa cát, đá, gỗ, mực nước, đèn (đèn tự theo giờ Asia/Saigon). Vảy vàng đổi tem vây và khuôn. Danh sách cá, đổi tên, sửa tranh, báo cáo, Chủ xị ẩn tranh.

## Chưa có so với Drawquarium

Sinh sản, cá con, tình bạn và cãi nhau. Cá ánh kim, cá vàng, cá phát sáng, Disco. Bộ tem mắt / vây đầy đủ và nhiều khuôn. Nhập PNG. Nhiều bể. Nhật ký, đồng hồ, danh sách việc — cố ý không mang sang, vì chỗ làm đã có việc riêng. Âm thanh mặc định tắt. Không có bản điện thoại.

## Đo trên cấu hình giả lập

Không đo trên Pentium thật. Cách đo (`npx tsx scripts/be-capture.ts`):

- Chrome headless, cửa sổ 1920×1080.
- `--disable-gpu`, `--disable-accelerated-2d-canvas`, `--disable-gpu-compositing`.
- CDP `Emulation.setCPUThrottlingRate = 6` (xấp xỉ 2 lõi yếu hơn máy đo; hệ số 4–6 là ước lượng, không phải cùng xung nhịp G6405).
- 37 cá đang ở trong kính, 15 socket giữ phòng.
- CPU và RAM là tiến trình Node trên máy ảo này, trong lúc 15 socket và một Chrome cùng chạy. Không phải MAY3.

Số đo được:

| Mục | Số |
|---|---|
| Khung hình giao được | trung bình **6,4**, thấp nhất **5,9** |
| Thời gian vẽ một khung | trung bình **5,9 ms**, cao nhất **7,4 ms** |
| Mức lúc đo | Vừa (cửa sổ 5 giây chưa kịp xuống Nhẹ, vì các khung đầu còn nhanh trước khi throttle ổn định) |
| Lần vẽ ảnh ở khung cuối | 132 |
| Canvas | 1150×858 |
| Heap JS (CDP `JSHeapUsedSize`) | khoảng 10 MB — số này thô, không phải profiler đầy đủ |
| Tải lớp bể + cá, lần đầu | **446 KB** |
| Tải lần sau (cache) | **957 byte** trên dây; nội dung cache vẫn khoảng 431 KB |
| CPU Node | **19% một lõi** trong khoảng 20 giây đo |
| RSS Node | **148 MB** |

Đọc số này thẳng: vẽ một khung rẻ (khoảng 6 ms) nhưng lịch 6× chỉ giao được khoảng 6 khung/giây. Hạ hiệu ứng không tự kéo khung lên nếu chính bộ lập lịch bị bóp. Trên máy thật cần đo lại; đây chỉ là giả lập.

Ảnh cho chủ xem (chụp không bóp CPU, để thấy tranh):

- [Bể mức Cao](anh/be-cao.png)
- [Bể mức Nhẹ](anh/be-nhe.png)
- [Giấy vẽ đang vẽ](anh/be-ve.png)
- [Cá vừa thả](anh/be-tha.png)
- [Chat cạnh bể](anh/be-chat.png)
- [Màn rời bể](anh/be-vang.png)
- [Cá đang bơi](anh/be-boi.webm)
