# Ao cá V3 — hướng dẫn duyệt cuối trên MAY3

- `#/chat` mở WebGL2 nếu có GPU thật. Máy thiếu WebGL2, có GPU phần mềm hoặc đã tự xuống mức Tĩnh sẽ dùng Canvas2D 30 FPS. Nền do người dùng chọn đi qua Canvas2D vì bản đồ đá/cát chỉ hiệu chỉnh cho Hang Đá.
- `#/chat?golden=1&seed=42` tải tám cá mẫu. Trong kiểm tra tự động, chọn `wide/closeup/uturn/depth/bubbles` bằng `window.__aoCa.scenario()`, rồi `advance(s)` theo bước 1/60 s. `fish=0&water=only` tách phép kiểm nền/ánh sáng P1.
- `#/chat?perf=1&tier=auto` hiện số khung, máy, mức, JS và GPU ms nếu driver có `EXT_disjoint_timer_query_webgl2`. Cờ `tier=cao|vua|nhe|tinh` ép mức. `bench=auto` có thêm 8 cá, 80 cá và B7; kết quả giữ theo cả kịch bản lẫn hệ số.
- Các thay đổi giữ nguyên nền Hang Đá. Không dùng hình hay asset Drawquarium trong app. Tài liệu nguồn dùng để đối chiếu ánh sáng, dáng cá và chuyển động: ảnh do Minh gửi và [trailer demo chính thức](https://www.youtube.com/watch?v=AOMjC3LBLgQ).

| Hạng mục | Thông số và chỗ chỉnh |
|---|---|
| Hai mặt cá | Cùng PNG; worker cắt alpha, tính EDT và mái vòm, nhân alpha vào RGB. Vành co từ phía trong để hai mặt về cùng độ sâu trước khi cắt alpha. Thiết lập chiều sâu và pháp tuyến chung theo mặt cắt ở góc chính diện. `fish-pixels.ts`, `fish-shaders.ts`. |
| Bộ nhớ và tải | Hai atlas 2048², ô 192×96 và lề 8 px, giới hạn 3 mip. Sao chép từng ô rồi tạo mip một lần mỗi đợt. Lưới Cao/Vừa 24×12, Nhẹ 16×8. Thu nhỏ từ 256×128 và 32×16 do lượt worker gồm giải mã có mẫu trên 30 ms. |
| Biến dạng | Nửa độ dày 0,20 × chiều cao cá; `uBendY=0,012` × chiều dài cá; pha tích phân theo thời gian. `fish-layer.ts`, `fish-school.ts`. Một lệnh vẽ cá nhờ instancing, một lệnh bóng. |
| Góc quay | Cruise ±21°, đổi hướng qua −90° tương đương trong 0,5–0,9 s. Độ dài ở giữa bể bằng 11% chiều ngang với cá hệ số 1. Trần 40/24/12/8. |
| Bọt/hạt | Xấp xỉ 15 bọt/s, bán kính 0,6–4 px CSS, bọt nở theo độ cao và tan 120 ms ở mặt nước. Quầng rộng khoảng 3% khung. Vẽ một lệnh cho quầng, một lệnh bọt, một lệnh hạt. `water-life.ts`. |
| Tự chuyển | Hai cửa sổ 4 s rớt >5% thì hạ. Nhẹ rớt ≥10% liên tiếp thì dùng Canvas2D. Sau khoảng 30 s ổn định thử mức cao hơn, giới hạn lần thử. Khoảng ngắt >250 ms đặt lại cửa sổ để Chrome bị che không làm hạ mức giả. `adaptive-tier.ts`. |
| Blur nút | Chọn **p90** để tính chi phí lúc khung chậm trên MAY3. B6 trừ B5-24 là 1,9 ms p90, 0,7 ms p50 tại 1366×768 @1 có tải, vì vậy tắt blur trong ao V3. |
| Tĩnh | 8 cá, DPR ≤1, ảnh nền HTML, sprite cắt sát/tint trước khi vẽ, bóng mềm và bọt viền dùng sprite dùng lại. `tank.ts`. |

## Tái tạo bằng chứng

```powershell
npm --prefix app run typecheck
npm --prefix app test
npm --prefix app run build
node app/scripts/ao-ca-visual.mjs --tier=cao --viewport=1366x768,1920x1080 --check --record
node app/scripts/ao-ca-fish-visual.mjs --record
node app/scripts/ao-ca-perf-may3.mjs
```

Số đo P0 ở [bảng 120 mẫu](AO-CA-V3-P0-MAY3.md). Ảnh, clip và log cuối nằm trong `app/test-results/ao-ca/` ngoài Git.

## Số đo xác minh trên MAY3

Intel UHD Graphics 610/ANGLE D3D11, RAM 1×8 GB. Chrome có giao diện, v-sync giữ nguyên. Ghi một mẫu cho mỗi cửa sổ HUD 4 s, 24 cá ở mức Cao/Vừa. GPU ms là mẫu query trả kết quả gần nhất, không phải phân vị của toàn lượt.

| Viewport / khoảng đo | Cá hiện | p90 trung vị | Rớt cao nhất của cửa sổ HUD | GPU ms trung vị |
|---|---:|---:|---:|---:|
| 1366×768, giây 124–300 | 24 | 16,8 ms | 3,9% | 2,91 |
| 1920×1080, giây 4–60 | 24 | 16,8 ms | 0% | 1,79 |

Lượt 1366×768 đủ 5 phút gồm 75 mẫu; giai đoạn đầu từng rớt tới 30,1% trong một cửa sổ. Mức ghi nhận theo thứ tự Cao → Vừa → Nhẹ (12 cá) → Vừa → Cao, trở lại 24 cá ở giây 120. Vì vậy ngưỡng ≤5% đạt trong đoạn ổn định nhưng chưa đạt xuyên suốt lượt 5 phút. Lần đo đầu bị Chrome bóp nhịp còn 1 Hz, đã loại và giữ log riêng. Các số P0 lịch sử chưa có GPU ms.

Ở golden U-turn, cá đạt chiều ngang 141 px khi nhìn ngang / 42 px chính diện ở 1366×768 và 199 / 60 px ở 1920×1080, tương đương khoảng 30%. Có 6 lệnh vẽ ở cảnh đủ cá, bọt, hạt. Không đo lại toàn bộ các ngưỡng pixel cho màu theo độ sâu, bóng và viền cá mềm; ảnh cùng clip dùng để duyệt bằng mắt. Ảnh góc 3/4 vẫn còn gợn ở viền đối với mẫu vẽ bằng các nét to. Worker có mẫu giải mã/cắt cá vượt 30 ms dù đã thu nhỏ ô; việc đó xảy ra trong worker.
