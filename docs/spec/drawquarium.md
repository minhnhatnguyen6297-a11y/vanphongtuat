# Drawquarium văn phòng

Phòng chat `#/chat` là một bể cá chung. Cách chơi bám Drawquarium: vẽ cá, cây, mồi, đồ; thả vào bể; cá tự bơi và lớn khi được cho ăn; cho ăn, hút cặn, sửa cát đá gỗ đèn mực nước. Thêm đúng một khung chat. Tin nhắn không điều khiển cá.

Bản này là prototype máy tính. Không làm bản điện thoại. Không đụng game Vườn.

## Vì sao chia việc giữa máy chủ và máy khách

Máy văn phòng yếu. Nếu mỗi máy tự nướng lại toàn bộ nét vẽ mỗi khung hình, CPU sẽ cháy dù bể chỉ có vài chục con. Game gốc cũng không chạy nổi trên card tích hợp.

Vì vậy nét vector chỉ là bản lưu. Lúc ghi, máy chủ nướng **một lần** thành ảnh PNG nhỏ (cá 192×96, cây 96×168, mồi 64×64, đồ 128×96), giữ file theo hash nội dung. Ảnh đã có thì lần sau chỉ đọc đĩa (`hit`, không `raster`). Các ảnh đang nằm trong bể được xếp vào atlas tối đa 1024×1024. Nền phòng, cát, đá, gỗ lũa, vân nước, tia sáng, bọt, mồi mặc định cũng được vẽ sẵn một lần (`SCENE_V`).

Đường dẫn có hash (`/be/g/<hash>.png`, `/be/a/<hash>.png`, `/be/s/<hash>.png`) và header `Cache-Control: public, max-age=31536000, immutable`. Máy khách chỉ tải ảnh làm sẵn rồi ghép. Đổi một con cá thì hash đổi, ảnh cũ vẫn nằm trong cache, ảnh mới là file khác.

Máy chủ cố tình rẻ:

- Không mô phỏng từng khung. Vị trí cá là hàm của id, cách bơi, pha và đồng hồ — mọi máy khách tính cùng một công thức.
- Không gửi nhịp sống liên tục. Chỉ gửi khi có việc của người đó, và không dày hơn 5 giây.
- Atlas dựng lại sau khi ghi (khoảng 280 ms), không dựng mỗi khung. Khách đang xem tải ảnh con mới ngay; atlas đầy đủ dành cho người vào sau.
- Giấy vẽ là ngoại lệ: người đang vẽ thấy nét ngay trên máy mình, ở đúng cỡ sprite sẽ được nướng. Bể không bao giờ vẽ lại từng nét.

Canvas 2D, không WebGL. Bộ lọc nước và shader dễ nặng đúng trên card tích hợp — thứ ta đang tránh. Nước đẹp nhờ lớp vẽ sẵn và lớp màu, không nhờ mô phỏng chất lỏng.

## Vì sao đồ họa vẫn có trần

Trần 30 khung/giây khi đang ngắm. Mức Nhẹ là 15. Không chạy 60. `devicePixelRatio` tối đa 1,5 ở mức Cao, còn lại khóa 1; mức Nhẹ vẽ nhỏ hơn (0,75) rồi phóng lên.

Mức bắt đầu là Vừa. Sau 5 giây, dưới 24 khung thì xuống một bậc, trên 28 khung thì lên một bậc, và không đổi lại ngay (chờ 8 giây). Máy báo khoảng 4 GB RAM thì không tự lên Cao. `prefers-reduced-motion` giữ mức Tĩnh: một khung đứng, không uốn, không bọt.

Tab ẩn thì hủy vòng vẽ ngay, không đợi hết giờ.

Cá gần người xem được uốn 2–3 khúc (đầu, mình, đuôi lệch pha). Cá xa chỉ một ảnh. Cây, đá, cát nằm trong lớp tĩnh, dựng lại khi đổi bể hoặc cỡ canvas, không dựng mỗi khung. Vân nước và tia sáng là ảnh lặp. Mức Vừa vẽ vân nước ở nửa độ nét, cách một khung. Mức Nhẹ tắt vân, tia, bọt.

Bể gốc của Drawquarium khoảng 10 cá. Prototype cho tối đa 40 cá, 16 cây, 12 đồ, 8 kiểu mồi, vì bể là của cả phòng và ảnh đã nướng. Khi đông, chỉ một ít con được uốn đủ khúc.

## Vì sao vắng thì phải tải lại

Máy yếu không nên vẽ bể cả ngày trong một tab bỏ quên.

- Tab đang hiện, không đụng gì: 15 phút.
- Tab ẩn hoặc cửa sổ khác: 5 phút, và không được dài hơn hạn của tab đang hiện (thu nhỏ không cộng thêm giờ).
- Báo trước 1 phút: «Sắp rời bể vì vắng.» Nút «Tôi vẫn ở đây».

Chỉ chuột, phím, lăn, vẽ, cho ăn, hút, kéo, gửi tin, hoặc nút ở lại mới tính. Cá tự bơi và tin của người khác không gia hạn — nếu không, phòng đông sẽ không bao giờ đá ai.

Hết giờ: dừng vẽ, bỏ ảnh trong bộ nhớ, đóng WebSocket, không tự nối lại. Câu trên màn: «Bạn đã rời bể vì vắng lâu — tải lại trang để vào lại». Nút «Vào lại» tải lại cả trang. Cá, cây, đồ, vảy không bị xóa.

Ba biến môi trường, đọc lúc mở máy chủ: `HNG_BE_IDLE_VISIBLE_MS`, `HNG_BE_IDLE_HIDDEN_MS`, `HNG_BE_IDLE_WARN_MS`. Mặc định 900000 / 300000 / 60000. Thử nghiệm truyền số nhỏ. Máy khách nhận đúng bộ số đó trong trạng thái bể, nên đồng hồ hai phía khớp.

## Chat đứng riêng

Cột phải là phòng chat `lobby` sẵn có. Gửi tin không kéo cá, không thả mồi, không hiện bong bóng trên đầu cá. Cho ăn vẫn là nút của bể.

Khung bể là một nút canvas giữ lại khi trang vẽ lại vì tin chat. Chỉ chữ trong cột chat đổi. Nếu không giữ nút đó, mỗi tin nhắn sẽ phá cảnh và phải tải lại ảnh.

## Những gì bản này chưa là Drawquarium

Cố ý để sau, vẫn theo game gốc chứ không đổi sang luật khác:

- Sinh sản, cá con, làm bạn, cãi nhau, câu nói trên thẻ cá.
- Cá ánh kim, cá vàng, cá phát sáng, Disco.
- Kho tem và khuôn lớn, nhập PNG.
- Nhiều bể, chuyển cá sang bể khác.
- Nhật ký, đồng hồ, danh sách việc — chỗ làm đã có việc riêng.
- Âm thanh. Mặc định game gốc cũng nên tắt trong giờ làm.

Bản đầu có: bút, tẩy, tô, nét thẳng, đối xứng, lật, làm mượt, bảng màu, pipet, hoàn / làm lại, phóng, khuôn cơ bản, tem mắt, bốn cách bơi, uốn mình, lớn khi ăn, kéo, theo tay, gõ mép kính, hút cặn, sửa cát đá gỗ đèn mực nước, vảy vàng đổi tem vây / tem vân / khuôn thêm, danh sách cá, sửa tranh của mình, chủ app ẩn tranh, người khác báo cáo.

Không sao chép tranh hay âm thanh của game gốc. Nền và nút vẽ lại cho app này.

## Cách đo

Số khung, thời gian khung, số lần vẽ, cỡ canvas và heap (nếu trình duyệt cho) nằm ở `window.__BE__`. Ô chữ chỉ hiện khi URL có `?bePerf=1`.

Đo máy yếu: Chrome tắt GPU (`--disable-gpu`, `--disable-accelerated-2d-canvas`, `--disable-gpu-compositing`) và `Emulation.setCPUThrottlingRate` = 6. Lần đầu là cache lạnh (cộng `transferSize` của mọi URL `/be/`). Tải lại là cache ấm. CPU máy chủ lấy từ `utime+stime` trong `/proc/<pid>/stat` suốt 8 giây đang ngắm — lúc đó máy chủ không vẽ. Lượt nướng đo riêng bằng `process.cpuUsage()` quanh lúc ghi cá.

Số đo một lần trên máy build này (36 cá, 4 cây, 4 người, script `app/scripts/be-measure.ts`):

| Việc | Số |
|---|---|
| Nướng 38 sprite khác nhau (2 cây trùng nét nên trúng cache) | CPU khoảng 0,4 giây, đồng hồ 2,8 giây (đồng hồ gồm cả khoảng chờ chống gửi dồn) |
| Đang ngắm, CPU máy chủ | khoảng 0,7% một lõi |
| Khung hình sau khi tự xuống Nhẹ | khoảng 13–14 khung/giây, mỗi khung khoảng 72 ms, 41 lần vẽ, canvas 655×387, DPR 0,75 |
| Tải lạnh | 8 file, khoảng 226 KB |
| Tải lại | `transferSize` = 0, nội dung vẫn khoảng 226 KB từ cache |
| Heap JS (`performance.memory`) | khoảng 3 MB. Đây là heap JS, không phải toàn bộ ảnh đã giải mã. CDP không trả `JSHeapUsedSize` trong lần đo này. |

13 khung/giây là mức Nhẹ đúng trần 12–15 của bản thiết kế, trên CPU bị hãm 6 lần và canvas phần mềm — không phải mức Cao 30 khung của máy khỏe.
