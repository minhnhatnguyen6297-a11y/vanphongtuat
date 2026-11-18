# P1 — Hiệu chỉnh Hang Đá và ánh sáng động

P1 dùng nền HTML Hang Đá giữ nguyên byte, khung WebGL trong suốt cho ánh sáng trên cát. Các URL `#/chat?golden=1&seed=42&tier=cao` và `#/chat?perf=1` mở renderer P1. `#/chat` vẫn mở ao Canvas2D hiện hành. Cảnh golden P1 chỉ có nước và nền; tám mẫu cá dùng làm đầu vào cho P2.

| Thông số | Giá trị và đơn vị | Lý do / vị trí chỉnh |
|---|---|---|
| Hiệu chỉnh nền | 1672×941 px; chân trời v=0,690, mặt nước v=0,113; dải bóng v=0,82–0,93 | Đọc trên lưới 5%, tọa độ UV tính từ trên xuống. Sửa `app/src/client/be/gl/scene-calib.json`. Nền HTML và WebGL dùng cùng phép cover tâm. |
| Camera | FOV dọc 45°; khoảng cách gần/xa 10/17 đơn vị cảnh; camera cao khoảng 1,99 đơn vị ở khung 16:9 | Tia ngang đi qua đường cát–nước. `app/src/client/be/fish-math.ts` chuyển UV qua cover; `sand-scene.ts` đặt phần tử chiếu dọc và cập nhật ma trận nghịch đảo. |
| Mặt nạ đá (R) | Nước = 255; đá = 0–254 theo độ sâu tương đối | Đa giác vẽ tay từ lưới, gần phủ xa. Sửa `app/scripts/ao-ca/scene-regions.json`. Chưa dùng R để che cá trong P1. |
| Mặt nạ cát (G) | Độ sáng Rec.709 ≥ 0,55 dưới chân trời, trừ đá; biên trong 4 px nguồn, làm mềm 2 px | G=0 ngoài cát, G=1 là khoảng đệm tắt sáng chống nội suy canvas; G=2–255 tăng độ sáng. Sửa `app/scripts/ao-ca-scene.mjs`. PNG lưu alpha 255 để giữ giá trị R/G khi giải mã. |
| Caustic | Tile 512 px (Cao), 256 px (Vừa/Nhẹ), 8 ô mỗi chiều; scale 0,12 tile/đơn vị, lớp thứ hai ×1,37; gain 0,18 | Bake Voronoi một lần, mipmap/repeat. Mỗi pixel có cát đọc tile hai lần; một quad từ chân trời xuống đáy, một lệnh vẽ mỗi khung. Sửa `gl/caustic.ts` và `gl/sand-scene.ts`. |
| Chuyển động | (0,020; 0,012) và (−0,015; 0,018) tile/s | Hai lớp trượt và lấy min. Golden seed 42, bước cố định 1/60 s; chạy lại cùng trạng thái cho cùng ảnh tại t=0. |
| Giảm tải MAY3 | Cao/Vừa/Nhẹ 1,05/0,62/0,36 Mpx, giới hạn DPR ≤1; mức Nhẹ khoảng 30 khung/s | Giảm canvas hiệu ứng, nền HTML vẫn nét. Tại 1920×1080 mức Cao dùng canvas 1366×768. Dừng cập nhật khi tab ẩn; ngừng vẽ khi mất WebGL context và dựng lại khi khôi phục. |

Nếu cần giảm tiếp, dùng `tier=vua` hoặc `tier=nhe`, đo lại sai khác ngoài G và kiểm tra chuyển động ở cả hai cỡ trước khi đổi ngân sách. Phần blur ở mức Cao vẫn chờ Minh chọn thống kê P0 cho ngưỡng 1 ms. P1 không thay đổi trần cá.

Tái tạo từ thư mục repo trên máy có Chrome tăng tốc phần cứng:

```powershell
node app/scripts/ao-ca-scene.mjs
npm --prefix app run build
node app/scripts/ao-ca-fixtures.mjs
node app/scripts/ao-ca-visual.mjs --tier=cao --viewport=1366x768,1920x1080 --check --record
```

Đầu ra ở `app/test-results/ao-ca/`: lưới, ảnh chồng R/G, ảnh `wide` tại t=0/2/6 s ở hai viewport, clip và JSON kiểm tra. Tám PNG pad thật nằm ở `app/tests/fixtures/ao-ca/`. Thư mục tham chiếu Drawquarium không có trên MAY3 tại thời điểm nộp; ảnh chồng được kiểm trực tiếp trên nền Hang Đá, chưa có ảnh ghép với Drawquarium.
