# Ao cá V3: chỉ dẫn kỹ thuật đồ họa cho máy yếu

Ngày: 2026-11-18 · Áp cho nhánh `vpt/ao-ca-v2-ui` (commit `8aafb89`) · Trạng thái: **BẢN 3, hướng đã chốt**

Tài liệu cho agent/dev làm ao cá. Cách giao việc, thứ tự pha và tiêu chí nộp nằm ở [`AO-CA-V3-HANDOFF.md`](AO-CA-V3-HANDOFF.md); đọc file đó trước. Bản 2 thay bản nháp 1 (Phụ lục A). Bản 3 chốt các mục `[DUYỆT]` của bản 2 (Phụ lục C).

**Nhãn dùng trong tài liệu**

| Nhãn | Nghĩa |
|---|---|
| `[CÓ SẴN]` | Lấy từ code, tài liệu dự án hoặc thông số nhà sản xuất |
| `[ƯỚC]` | Con số đề xuất hoặc ước tính, **chưa đo** trên máy đích. Thay bằng số đo ở P0/P3 (mục 9) |
| `[CHỐT]` | Mục từng chờ duyệt, nay đã quyết (Phụ lục C). Đổi lại phải ghi lý do vào `docs/THIET-KE.md` |

---

## 0. Phạm vi

Minh thu hẹp phạm vi: **chỉ làm tốt nhất phần đồ họa**, chạy được trên máy văn phòng cấu hình thấp. Không chạy theo các chức năng của game gốc.

| Trong phạm vi | Ngoài phạm vi (giữ code hiện có, không mở rộng) |
|---|---|
| Cá vẽ tay có khối: phồng hai mặt, chiếu sáng | Trình vẽ mới (Flow, Hardness, Lazy Mouse, xô màu, HSV, Redo). Giữ pad 480×240 hiện có |
| Bơi uốn thân, quay chữ U qua góc 3/4 | Thức ăn chìm, cá tranh ăn, tò mò, vuốt cá, gõ kính, con trỏ bàn tay |
| Caustic trên cát và trên thân cá | Đèn Ngày/Chiều/Đêm. Chỉ gom thông số đèn vào một object `LightRig` để thêm sau |
| Đổi màu cá theo độ sâu (hấp thụ) và theo khoảng cách (sương) | Bảng chỉnh bể, cây đung đưa, mặt nước 3D, nền mới |
| Bóng cá trên cát, cá khuất sau đá trong ảnh nền | Cá đáy, cá lớn lên, chọn kiểu bơi |
| Cột bọt có viền, hạt lơ lửng | Âm thanh |
| Tự hạ chất lượng theo máy; đường lui Canvas2D | |

Nút **Cho ăn / Xua** hiện có được giữ ở mức tối thiểu: tạo cụm bọt và cho vài cá gần điểm bấm đổi hướng. Không làm thêm hành vi.

**Ràng buộc từ tài liệu đã chốt** `[CÓ SẴN]`

- `design.md` mục 7: **không sửa nền** đã duyệt (`hang-da-v2.png`, ảnh chụp có sẵn tia sáng, gợn mặt nước, caustic tĩnh trên cát). V3 chỉ **vẽ thêm lên trên** và dùng mặt nạ suy ra từ ảnh. Ảnh hiển thị phải giữ nguyên từng điểm ảnh ở vùng không có hiệu ứng (kiểm tra ở mục 10.3).
- `design.md` mục 7: giữ nguyên nét tranh người chơi, đầu cá quay sang phải.
- `agents.md`: Neo-Brutalism áp cho **vỏ UI** (nút, bảng, popup vẽ). **Cảnh nước bên trong canvas không áp:** không viền mực, không bóng cứng, không màu token.
- `agents.md`: tên biến, hàm tiếng Anh; không framework UI nặng; thêm thư viện render thì ghi vào `docs/THIET-KE.md` cùng PR, kèm lý do.
- Máy chủ giữ danh sách cá (`tank_fish`, tối đa **80 cá** toàn bể, 12 cá mỗi người: `app/src/server/commands/fish.ts`). Mô phỏng và render chạy ở từng máy.

---

## 1. Vì sao các vòng trước báo "ĐẠT" mà không khớp

| Nguyên nhân | Bằng chứng trong nhánh | Cách chặn |
|---|---|---|
| Agent tự chấm theo bảng thông số do chính nó đặt | `DESIGN-DECISIONS-V2.md` ghi "ĐẠT vòng 2" khi repo chưa có ảnh gốc nào | Kết luận phải kèm ảnh ghép ta ↔ gốc do script sinh (mục 10) |
| Kỹ thuật nền sai, chỉnh thông số không cứu được | Cá là sprite lật ngang, co 28% (`motion.ts:22`); đuôi là ảnh cắt hai mảnh rồi xoay (`tank.ts:575-598`) | Lưới uốn bằng shader (mục 5) |
| "Khúc xạ" là 6 ellipse và 3 đường bezier toàn màn | `tank.ts:459-487`; trên video thành 3 vệt ngang mảnh xuyên màn | Xóa. Caustic là lưới sáng chiếu lên cát và thân cá (mục 6.1) |
| Cá quá nhỏ | Sprite 128×68 nhân depth 0,55–1,1, cá dài ~5% bề ngang | Cắt sát alpha; cá ở giữa độ sâu dài 9–14% bề ngang |
| Cá như dán lên ảnh | Không bóng, không đổi màu theo độ sâu | Chiếu sáng, bóng, hấp thụ, sương (mục 5.4, 6) |
| Không đo hiệu năng trên máy đích | Không có số khung hình nào; `blur()` cho từng cá (`tank.ts:569`) và `backdrop-filter: blur(12px)` trên nút đè lên canvas động | Đo theo mục 9 trước và sau mỗi pha |

**Luật:** agent **không được** ghi "ĐẠT". Agent chỉ ghi `CHỜ DUYỆT`, kèm đường dẫn ảnh ghép, video và bảng số đo. Chỉ Minh đổi sang `ĐẠT` hoặc `CHƯA`.

---

## 2. Tư liệu bản gốc

Ảnh tham chiếu ở `.ref/drawquarium/` (đã nằm trong `.git/info/exclude`, **không commit**; ảnh của game khác, chỉ để đối chiếu nội bộ). Chỉ liệt kê ảnh dùng cho đồ họa:

| File | Dùng để đối chiếu |
|---|---|
| `so-sanh-tong-the.jpg` | Ao ta (trái) ↔ gốc (phải): cỡ cá, vệt ngang, độ "ở trong nước" |
| `goc-ca-phong-sang.jpg` | Cận cảnh: thân phồng, bóng láng, vây trong mờ, **bóng mềm trên cát** |
| `goc-be-ui-bot.jpg` | Cột bọt: nhiều chấm nhỏ trên một quầng sáng mờ, không phải vài bọt to |
| `goc-boi-t0/t05/t10.jpg` | Ba khung cách 0,5 s: cá xoay yaw 3D, thấy góc 3/4 |
| `goc-be-lua.png` | Sương xanh theo chiều sâu, cá xa nhạt và ngả màu nước |

Nguồn: video "Drawquarium Gameplay | Full Game Relaxing ASMR Longplay" (YouTube `7ZAQ-q9hBd0`), trailer (`Z-NTmezsVds`). Mục tiêu là đạt cùng **chất** (cá vẽ tay có khối, sống trong nước có ánh sáng), không chép game.

Khác biệt cố định khi so ảnh: nền gốc xanh lam đậm, nền ta là ảnh chụp xanh ngọc đã duyệt. Người duyệt so **khối, ánh sáng, chuyển động, cỡ**, không so tông màu nền.

---

## 3. Máy đích và ngân sách hiệu năng

### 3.1 Máy đích

| Mục | Giá trị | Nguồn |
|---|---|---|
| CPU | Pentium Gold G6405, 2 lõi / 4 luồng, 4,1 GHz | `[CÓ SẴN]` `KIEN-TRUC-DE-XUAT.md:71` |
| GPU | Intel UHD 610 (Gen 9.5 GT1): 12 EU, tối đa 1,05 GHz, ~200 GFLOPS FP32 đỉnh lý thuyết, dùng chung RAM | `[CÓ SẴN]` thông số Intel |
| RAM | 8 GB, Windows 10 Pro 19043 | `[CÓ SẴN]` DxDiag |
| Băng thông RAM | DDR4-2666: ~42,7 GB/s nếu 2 kênh, **~21,3 GB/s nếu chỉ 1 thanh**. 8 GB thường là 1 thanh | **Chưa biết.** Xem Task Manager → Hiệu suất → Bộ nhớ → "Khe đã dùng" |
| Màn hình | 1366×768 hoặc 1920×1080, DPR 1 hoặc 1,25 | **Chưa biết.** Ghi khi đo |
| Trình duyệt | Chrome/Edge, WebGL2 qua ANGLE D3D11 | **Chưa biết.** Xem `chrome://gpu` |

Máy người dùng trong văn phòng coi là cùng mức này, trừ khi đo được khác. Hiệu ứng chạy trên máy người dùng, không chạy trên máy chủ.

**Rủi ro lớn nhất:** driver Intel cũ bị Chrome chặn GPU, WebGL rơi xuống **SwiftShader** (render bằng CPU). Khi đó mọi con số vô nghĩa và ao sẽ giật. Phải phát hiện và chuyển sang đường lui (mục 4.5).

### 3.2 Cái gì tốn trên UHD 610

| Nguồn tốn | Vì sao | Cách tránh |
|---|---|---|
| Số điểm ảnh tô (fill) × độ nặng shader | 12 EU; hàm `sin`, `pow` chạy ở tốc độ 1/4 | Render canvas ở độ phân giải thấp hơn màn hình; shader cá ít phép; caustic bake sẵn |
| Băng thông bộ nhớ dùng chung | Mỗi lớp toàn màn đọc và ghi lại RAM; trình duyệt còn ghép canvas với trang | Ít lớp toàn màn; nền vẽ bằng `<img>` tĩnh; quad cát chỉ phủ dải cát |
| `backdrop-filter` đè lên canvas động | Trình duyệt làm mờ lại vùng dưới nút **mỗi khung** | Tắt ở mức Vừa/Nhẹ/Tĩnh `[CHỐT]` |
| Canvas2D `filter: blur()` | Thường rơi về đường xử lý chậm | Cấm trong ao |
| MSAA (`antialias: true`) | Nhân băng thông | Tắt; mép cá đã mềm nhờ alpha |
| Upload texture lớn giữa chừng | Upload lại atlas 2048² mỗi lần thêm cá: ~16 MB | Chỉ `texSubImage2D` đúng ô của cá mới |
| CPU 2 lõi | Tiền xử lý 80 cá trên luồng chính gây khựng | Worker, cá hiện dần |

Số điểm ảnh: 1366×768 = 1,05 Mpx; 1920×1080 = 2,07 Mpx. Render 1080p đủ độ phân giải tốn gấp đôi 768p.

### 3.3 Mức chất lượng

Mức theo **ngân sách điểm ảnh** của canvas, không theo hệ số cố định, để 768p và 1080p tốn như nhau. Nền là `<img>` nên luôn nét, chỉ cá và hiệu ứng bị giảm phân giải. Các ngân sách, hệ số và hiệu ứng chưa đo riêng vẫn là `[ƯỚC]`; trần xem ghi chú đo dưới bảng.

| | Cao | Vừa | Nhẹ | Tĩnh (đường lui) |
|---|---|---|---|---|
| Điểm ảnh canvas tối đa | 1,05 Mpx | 0,62 Mpx | 0,36 Mpx | Canvas2D, DPR 1 |
| Hệ số ở 1366×768 | 1,0 | 0,77 | 0,58 | 1,0 |
| Hệ số ở 1920×1080 | 0,71 | 0,55 | 0,42 | 0,71 |
| Khung/giây đích | 60 | 60 | 30 (bỏ 1 khung rAF trong mỗi 2 khung) | 30 |
| Cá hiển thị tối đa `[CHỐT]` | 40 | 24 | 12 | 8 |
| Lưới mỗi mặt cá | 32×16 | 24×12 | 16×8 | sprite |
| Caustic trên cá / bóng láng | có / có | có / có | không / không | không |
| Caustic trên cát | có | có | có | không |
| Bóng cá, hấp thụ, sương | có | có | có | bóng elip, tint |
| Bọt sống tối đa / hạt lơ lửng | 220 / 100 | 160 / 60 | 90 / 30 | 40 / 18 |
| `backdrop-filter` trên nút `[CHỐT]` | giữ nếu B6 ≤ 1 ms, không thì tắt | tắt, dùng nền đặc `#091d2a` 88% | tắt | tắt |
| Ngân sách GPU mỗi khung | ≤ 11 ms | ≤ 11 ms | ≤ 22 ms | – |
| Ngân sách JS ao mỗi khung | ≤ 2 ms | ≤ 2 ms | ≤ 2 ms | ≤ 3 ms |


[ĐO 18/11/2026, MAY3] Nguồn: [bảng P0 MAY3](AO-CA-V3-P0-MAY3.md), lượt **có tải 1366×768**, 1920×1080 dùng đối chiếu. Trần giữ **40/24/12/8** theo handoff mục 5. Ở các hệ số đo 1/0,75/0,5, cảnh 80 cá giả có p90 lần lượt 4,4/4,0/3,8 ms và HUD báo 0% rớt; các trần WebGL hiện hành không cần hạ. Tĩnh 8 là đường lui chưa đo riêng. Ngân sách GPU vẫn [ƯỚC] vì GPU ms còn thiếu.

[ĐO 18/11/2026, MAY3] B6 − B5-24 = **0,7 ms p50 / 1,9 ms p90** ở 1366×768, hệ số 1, có tải. Handoff chưa chỉ rõ thống kê dùng cho ngưỡng 1 ms, chờ Minh chốt. B1 p50 3,3 ms, B7 4,3 ms: giữ nền ảnh HTML. B4 vẫn dùng caustic bake theo mục 5.

Hệ số = `min(1, sqrt(maxPixels / (cssW × cssH)))`, nhân với `min(devicePixelRatio, 1)`. **Không bao giờ render quá 1× pixel CSS** trên máy này.

"Cá hiển thị tối đa" `[CHỐT]`: máy chủ cho tới 80 cá. Khi vượt trần, cá dư "nghỉ" ngoài khung nhìn và đổi lượt mỗi 150 s ± 30 s: một cá đang hiện bơi ra mép gần nhất rồi biến mất, một cá đang nghỉ bơi vào từ mép đối diện; mỗi lần đổi tối đa 2 cá. Thứ tự ưu tiên luôn hiện: (1) cá của chính người đang xem, tối đa 4 con mới nhất; (2) cá thả trong 10 phút gần nhất; (3) còn lại xoay vòng theo thời gian nghỉ lâu nhất. Lý do: giữ khung hình trên UHD 610 mà vẫn để mọi cá được thấy; mọi phiên vẫn có cùng tập cá (luật `docs/THIET-KE.md` mục 12), chỉ khác cá nào đang ở trong khung. Ghi quyết định này vào `docs/THIET-KE.md` mục 12 trong PR của P2.

### 3.4 Tự chuyển mức

Đo bằng khoảng cách giữa các lần `requestAnimationFrame`. Trình duyệt khóa theo tần số quét (vsync), nên khoảng cách luôn ~16,7 ms khi máy còn dư; **không đọc được độ dư từ đó**. Vì vậy hạ mức theo khung rớt, lên mức bằng cách chạy thử.

```
nominal   = trung vị khoảng cách 60 khung đầu (60 Hz → 16.7 ms, 75 Hz → 13.3 ms)
target    = nominal ở mức Cao/Vừa, 2 × nominal ở mức Nhẹ
dropped   = khung có khoảng cách > 1.5 × target
cửa sổ    = 4 s; bỏ qua cửa sổ có: tab ẩn, đổi cỡ, upload atlas, 3 s đầu sau khi mở ao

Hạ 1 mức  : 2 cửa sổ liên tiếp có dropped > 5%
Thử lên   : đã ổn định 30 s (dropped < 1%) → chạy mức cao hơn 5 s;
            dropped > 3% thì quay lại và cấm thử mức đó 10 phút; tối đa 3 lần thử mỗi phiên
Nhẹ vẫn rớt (dropped > 10% trong 8 s) → chuyển Tĩnh, toast "Ao cá chuyển chế độ nhẹ"
Nhớ mức   : localStorage `hng_ao_tier` (tiện ích riêng từng máy, không phải dữ liệu); lần sau khởi đầu từ đó
Ép mức    : `?tier=cao|vua|nhe|tinh` để thử nghiệm
```

Nếu `EXT_disjoint_timer_query_webgl2` có trên máy đích (Chrome thường tắt), dùng số ms GPU cho HUD đo, **không** dùng để quyết định mức.

---

## 4. Kiến trúc render

### 4.1 Thư viện

| | three.js (chỉ `RawShaderMaterial` + `InstancedBufferGeometry`) | OGL | WebGL2 thuần |
|---|---|---|---|
| Kích thước gói | ~150–180 KB gzip `[ƯỚC]`, tree-shaking kém | ~25 KB | 0 |
| Chi phí mỗi khung với 6 lệnh vẽ | không đáng kể | không đáng kể | không đáng kể |
| Tài liệu, ví dụ cho agent | nhiều nhất | ít, agent dễ đoán sai API | nhiều, nhưng tự quản state, dễ lỗi |
| Có sẵn | instancing, render-to-texture, `compileAsync`, xử lý mất context | phần lớn | tự viết ~400 dòng |

**Chọn three.js, ghim phiên bản** (ví dụ `three@0.170.0`; ghi phiên bản thật vào `docs/THIET-KE.md`). Lý do: cảnh chỉ có ~6 lệnh vẽ toàn shader tự viết, nên chi phí chạy của ba lựa chọn như nhau. Khác biệt nằm ở tỉ lệ agent viết sai. Chi phí thêm là tải và parse JS một lần.

Điều kiện đi kèm:
- Cấm dùng: `MeshStandardMaterial`/`MeshPhysicalMaterial`, `renderer.shadowMap`, `EffectComposer`, các pass hậu kỳ (bloom, DOF), `antialias: true`, đèn của three. Mọi vật liệu là `RawShaderMaterial` với `glslVersion: THREE.GLSL3`.
- Build hiện tại (`app/scripts/build.mjs`) gom mọi thứ vào **một** `app.js`, không minify, không tách gói. Thêm three thì: bật `minify: true`, **và** tách renderer ao thành entry riêng nạp bằng `import()` khi vào màn ao (esbuild cần `splitting: true` với `outdir`). Ghi kích thước gói trước/sau vào PR.
- three từ r163 chỉ còn WebGL2. Không có WebGL2 thì dùng đường lui Tĩnh.

### 4.2 Các lớp trên màn

```
[DOM] <img> nền hang-da-v2 (object-fit: cover)           ← trình duyệt ghép, tĩnh, luôn nét
[DOM] <canvas> WebGL trong suốt (alpha, premultiplied)     ← cát-caustic, bóng, cá, bọt, hạt
[DOM] UI vỏ: nút tròn, chat, popup vẽ (Neo-Brutalism)
```

- Không vẽ ảnh nền trong WebGL: tiết kiệm một lớp toàn màn mỗi khung, và nền giữ nét khi canvas render ở hệ số < 1.
- Canvas đặt `width/height` theo hệ số mức (mục 3.3), CSS 100%. Trình duyệt tự phóng lúc ghép trang: **không** tự làm thêm pass upscale.
- `getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: true, stencil: false, powerPreference: 'default', failIfMajorPerformanceCaveat: true })`. Xóa nền về `(0,0,0,0)`.
- Mọi shader xuất màu **premultiplied** `vec4(rgb·a, a)`, blend `ONE, ONE_MINUS_SRC_ALPHA`. Làm sáng (caustic) bằng cách xuất màu đèn với alpha nhỏ; làm tối (bóng) bằng đen với alpha nhỏ. Không dùng mẹo "rgb > a" để cộng màu: WebGL không bảo đảm kết quả.
- Làm việc trong không gian sRGB, không chuyển linear. Đây là chủ ý: rẻ, và khớp với ảnh nền do trình duyệt vẽ.

**Phương án dự phòng** `[ƯỚC]`: nếu đo ở P0 thấy canvas trong suốt ghép tốn hơn vẽ nền trong WebGL (canvas đục), đổi sang canvas đục có vẽ nền. Chỉ đổi khi có số đo.

### 4.3 Bản đồ cảnh và hiệu chỉnh camera theo ảnh nền

Ảnh nền là ảnh 2D chụp từ camera thấp nhìn ngang. Để bóng cá rơi đúng lên cát trong ảnh và cá khuất sau đá, cảnh 3D phải **khớp phối cảnh của ảnh**. Bản nháp 1 chọn fov và khoảng cách camera tùy ý; cách đó không khớp ảnh.

**Asset `scene-map.png`** (RGBA8, cùng kích thước ảnh nền 1672×941, PNG không mất dữ liệu), tạo một lần (mục 8):

| Kênh | Nội dung |
|---|---|
| R | Độ sâu chuẩn hóa của vật trong ảnh: `0` = ngay kính trước, `1` = sau cùng của vùng cá bơi; **`255` = nước, không che**. Vẽ tay từng tảng đá bằng mảng xám phẳng |
| G | Mặt nạ cát (255 = cát lộ, nhận bóng và caustic) |
| B, A | Để trống |

**Tệp `scene-calib.json`** (đo trên ảnh gốc, tọa độ chia cho kích thước ảnh, `v` tính từ trên xuống):

```json
{
  "image": [1672, 941],
  "horizonV": 0.68,
  "surfaceV": 0.12,
  "fishShadowV": [0.82, 0.93],
  "fogSampleRect": [0.55, 0.30, 0.85, 0.50],
  "lightDir": [-0.3, 1.0, 0.2],
  "bubbleSourceUV": [0.78, 0.62]
}
```

Các số trên là ước bằng mắt `[ƯỚC]`: chân trời ở chỗ cát gặp nước xa, khoảng 0,66–0,69; mặt nước ở dải gợn sáng phía trên. Đo lại bằng ảnh có lưới (mục 8), không đoán.

**Dựng camera** (camera nhìn ngang theo −z, dịch ống kính để chân trời nằm đúng chỗ):

- Phối cảnh giữa cá gần và cá xa chỉ phụ thuộc tỉ lệ khoảng cách `D_back / D_front`; fov chỉ đổi thang đơn vị. Chọn `fov = 45°`, `D_front = 10`, `D_back = 17` (cá xa nhỏ còn ~0,59 lần cá gần) `[ƯỚC]`. Bản nháp 1 (fov 35°, camera cách 2,2× bề rộng) cho tỉ lệ ~1,17: gần như không có chiều sâu, và bể chỉ phủ ~72% bề ngang màn.
- Gọi `hv` là vị trí chân trời trên **màn** (từ `horizonV` qua phép cover ảnh → khung nhìn, tính lại mỗi khi đổi cỡ); `horizonNdc = 1 − 2·hv`.
- Chiều cao camera trên cát: `camHeight = 2 · (fishShadowV[1] − hv) · tan(fov/2) · D_front`. Khi đó bóng của cá ở hàng trước rơi đúng `fishShadowV[1]`.
- Mặt nước: `surfaceY = camY + 2 · (hv − surfaceV) · tan(fov/2) · D_front`.
- Dịch ống kính: sau `updateProjectionMatrix()` gán phần tử dịch dọc của `projectionMatrix` rồi cập nhật `projectionMatrixInverse`. Dấu của phần tử này dễ sai: viết unit test "điểm `(0, 0, −100)` trong hệ camera chiếu ra `ndc.y = horizonNdc`" rồi mới dùng.
- Biên bơi ở mỗi độ sâu lấy từ hình chóp nhìn, trừ lề 0,6·L; `y` từ `sandY + 0,5·H` tới `surfaceY − 0,7·H`.
- `uSceneXform`: hệ số đổi `gl_FragCoord.xy` (pixel canvas, gốc dưới trái) sang UV của `scene-map` theo đúng phép cover của `<img>`. Tính lại khi đổi cỡ hoặc đổi mức.

Màu sương `uFog` = trung bình màu ảnh nền trong `fogSampleRect`, tính một lần lúc nạp, không chọn tay.

### 4.4 Lệnh vẽ mỗi khung

| # | Lệnh | Phủ | Ghi chú |
|---|---|---|---|
| 1 | Caustic cát | quad từ chân trời xuống đáy màn (~32% màn) | không phủ toàn màn |
| 2 | Bóng cá | instanced, 1 lệnh | |
| 3 | Cá | instanced, 1 lệnh, mọi cá | sắp xếp xa → gần trên CPU, ghi lại buffer instance |
| 4 | Quầng cột bọt | 1 quad | |
| 5 | Bọt | instanced, 1 lệnh | |
| 6 | Hạt lơ lửng | `gl.POINTS`, 1 lệnh | |

Tổng 6 lệnh vẽ, không đổi theo số cá. Kiểm bằng `renderer.info.render.calls`.

### 4.5 Khởi động, lỗi, mất context

- **Phát hiện GPU phần mềm:** nếu `getContext` trả `null` (do `failIfMajorPerformanceCaveat`), hoặc chuỗi `WEBGL_debug_renderer_info` chứa `SwiftShader`, `llvmpipe`, `Basic Render`, `Microsoft Basic` thì dùng Tĩnh. Ghi chuỗi renderer vào HUD đo.
- Nền `<img>` hiện ngay; canvas mờ dần lên khi shader đã biên dịch (`renderer.compileAsync`, dùng `KHR_parallel_shader_compile` nếu có). Trên ANGLE, mỗi chương trình có thể mất 100–300 ms để biên dịch `[ƯỚC]`.
- `webglcontextlost`: gọi `preventDefault()`, dừng vòng lặp; `webglcontextrestored`: dựng lại texture, atlas và buffer. Driver Intel hay mất context sau khi máy ngủ dậy.
- Dừng vòng lặp khi `document.hidden` hoặc canvas không còn trong DOM (code v2 đã làm vế sau). `dt` kẹp tối đa 0,05 s.
- `mesh.frustumCulled = false` cho mesh instanced: khối bao của lưới gốc không phản ánh vị trí các cá.

---

## 5. Cá

### 5.1 Tiền xử lý trong Worker (mỗi cá một lần)

Chạy trong **một** Web Worker (máy có 2 lõi: một lõi cho luồng chính, một cho worker). Cá xử lý xong thì mờ dần vào bể. Thời gian mỗi cá `[ƯỚC]` 5–15 ms; 80 cá có thể mất 0,4–1,2 s, phải đo.

```
input: id, pngBytes (PNG người chơi, 480×240, đầu quay phải)
1. bmp = await createImageBitmap(new Blob([pngBytes]))
2. Cắt sát khung alpha > 8, thêm lề 4 px.
3. Thu vào ô SLOT 256×128, giữ tỉ lệ (OffscreenCanvas). Ghi lại khung dùng thật (w, h) để biết tỉ lệ cá.
4. Màu: nhân alpha vào rgb (premultiply). Nếu không, mép mềm và mipmap sẽ viền đen.
5. Mặt nạ m = alpha ≥ 128. d = biến đổi khoảng cách Euclid (Felzenszwalb, 2 lượt, O(n)).
6. x = d / max(d); h = sqrt(1 − (1 − x)²)            // mái tròn, đỉnh phẳng
7. h = gaussBlur(h, σ = 2 px)                        // xóa nếp gãy dọc trục giữa của distance field
8. h *= smoothstep(0.02, 0.30, alpha)                 // mép có alpha mềm về 0
9. (tùy chọn) h += 0.03 · ink, ink = smoothstep(0.35, 0.10, độ sáng) đã làm mờ 1 px: nét mực hơi nổi
10. Pháp tuyến: hPx = h · uThick · slotFishHeightPx;
    n = normalize(−∂hPx/∂x, −∂hPx/∂y, 1) bằng sai phân trung tâm.
    Dùng cùng uThick với hình học (5.3) nên bóng sáng khớp với độ phồng thật.
11. Gửi về (transfer): colorRGBA (premultiplied), shapeRGBA = (n.x·0.5+0.5, n.y·0.5+0.5, h, 255), w, h
```

Lý do đổi so với bản nháp 1: hồ sơ `sqrt(x)` có đỉnh nhọn nên lộ nếp gãy dọc trục giữa trên normal map; `sqrt(1−(1−x)²)` cộng làm mờ thì không. Chạy trên luồng chính sẽ khựng khi vào bể có nhiều cá.

**Atlas:** 2 texture 2048×2048 RGBA8 (màu, hình). Ô 256×128 có lề 8 px → 7 cột × 15 hàng = 105 ô, đủ 80 cá. Bộ nhớ GPU ~43 MB gồm mipmap, lấy từ RAM chung `[ƯỚC]`. Mipmap tối đa 3 mức (`TEXTURE_MAX_LEVEL = 3`) để màu các ô không lem sang nhau. Thêm cá: `texSubImage2D` đúng ô (với three: `renderer.copyTextureToTexture`; chữ ký hàm đổi theo phiên bản, kiểm với bản đã ghim), rồi `generateMipmap` **một lần** cho mỗi đợt cá mới. Không đặt `needsUpdate` cho cả atlas.

### 5.2 Lưới và instancing

- Một lưới chung `NX×NY` (theo mức) trên mặt `x, y ∈ [−0.5, 0.5]`, nhân đôi thành hai mặt: thuộc tính `aSide = +1` (mặt trước, thứ tự đỉnh ngược chiều kim đồng hồ khi nhìn từ +z) và `aSide = −1` (**đảo thứ tự đỉnh**). Bật cull mặt sau. Nhờ vậy cả cá là **một lệnh vẽ**; từ phía nào nhìn cũng chỉ thấy nửa hướng về camera. Mặt sau tự hiện ảnh lật gương, đúng cho cá bơi sang trái: **không** dùng `scale(−1, 1)`.
- Thuộc tính mỗi cá (`InstancedBufferAttribute`, `DynamicDrawUsage`):

| Tên | Kiểu | Nội dung |
|---|---|---|
| `iPos` | vec3 | tâm cá, tọa độ thế giới |
| `iRot` | vec3 | yaw, pitch, roll (rad) |
| `iSize` | vec2 | dài L, cao H; H = L × tỉ lệ khung cá thật |
| `iWave` | vec3 | x = pha đã tích phân trên CPU, y = biên độ (theo L), z = số bước sóng trên thân |
| `iAtlas` | vec4 | u0, v0, du, dv của khung cá thật trong ô |

- Mỗi khung: sắp các cá đang hiện theo khoảng cách tới camera, xa trước; ghi vào buffer (~15 float/cá); đặt `geometry.instanceCount`.
- **Pha sóng tích phân trên CPU:** `phase += 2π · freq · dt`. Bản nháp 1 dùng `sin(… − uFreq·uTime + uPhase)`: khi tốc độ cá đổi thì `uFreq` đổi, `uFreq·uTime` nhảy lớn (uTime tăng mãi), đuôi giật.

### 5.3 Vertex shader

```glsl
// fish.vert — GLSL ES 3.00 (three thêm #version khi glslVersion = THREE.GLSL3)
precision highp float;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform sampler2D uShape;   // R,G = pháp tuyến xy (0..1); B = độ phồng h (0..1)
uniform float uThick;       // nửa độ dày / chiều cao cá. Khởi điểm 0.20 [ƯỚC]
in vec3 position;           // x, y ∈ [-0.5, 0.5], z = 0
in vec2 uv;                 // 0..1 trong khung cá
in float aSide;             // +1 mặt trước, -1 mặt sau
in vec3 iPos; in vec3 iRot; in vec2 iSize; in vec3 iWave; in vec4 iAtlas;
out vec2 vUv; out vec3 vWorld; out vec3 vN; out vec3 vT; out float vSide;

mat3 rotYPR(vec3 r) {                       // R = Ry(yaw) * Rz(pitch) * Rx(roll); mat3 theo cột
  float cy = cos(r.x), sy = sin(r.x), cp = cos(r.y), sp = sin(r.y), cr = cos(r.z), sr = sin(r.z);
  mat3 ry = mat3(cy, 0.0, -sy,  0.0, 1.0, 0.0,  sy, 0.0, cy);
  mat3 rz = mat3(cp, sp, 0.0,  -sp, cp, 0.0,  0.0, 0.0, 1.0);
  mat3 rx = mat3(1.0, 0.0, 0.0,  0.0, cr, sr,  0.0, -sr, cr);
  return ry * rz * rx;
}

void main() {
  vec2 auv = iAtlas.xy + uv * iAtlas.zw;
  float s = 0.5 - position.x;                          // 0 = mũi (x = +0.5), 1 = đuôi
  float env = 0.12 + 0.88 * s * s;                     // đầu gần như đứng yên
  float k = iWave.z * 6.2831853;
  float ang = k * s - iWave.x;                         // pha tăng → sóng chạy từ đầu về đuôi
  float bend = iWave.y * env * sin(ang);               // lệch ngang, theo L
  float slope = -iWave.y * (1.76 * s * sin(ang) + env * k * cos(ang));   // d(bend)/dx, vì ds/dx = -1
  float h = textureLod(uShape, auv, 0.0).b;
  vec3 p = vec3(position.x * iSize.x,
                position.y * iSize.y,
                bend * iSize.x + aSide * h * uThick * iSize.y);
  mat3 R = rotYPR(iRot);
  vec3 w = iPos + R * p;
  vWorld = w;
  vT = R * normalize(vec3(1.0, 0.0, slope));
  vN = R * (normalize(vec3(-slope, 0.0, 1.0)) * aSide);
  vUv = auv;
  vSide = aSide;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
```

Quy ước góc: `yaw = atan2(−vel.z, vel.x)` (khớp `Ry` ở trên và quy ước của three); `pitch > 0` là ngóc mũi lên.

**Điểm phải hiểu:** sóng thân lệch theo trục z cục bộ, là hướng uốn thật của cá. Khi cá nằm ngang trước camera, độ lệch này gần như chỉ đi **vào/ra khỏi màn**, mắt thấy rất ít. Sóng chỉ đọc được qua (1) **ánh sáng đổi trên thân** (vì thế `vN`/`vT` theo độ dốc là bắt buộc ở mọi mức, không phải tùy chọn như bản nháp 1), (2) cá thường bơi lệch yaw 10–25°, (3) lúc quay. Thành phần lệch trong mặt phẳng `p.y += uBendY · iSize.x · env · sin(ang)` `[CHỐT]`: mặc định `uBendY = 0`. Nếu kiểm tra "Sóng thân đọc được" (10.3) trượt với `uBendY = 0`, đặt `uBendY = 0.012` rồi chạy lại; vẫn trượt thì tối đa `0.02`. Ghi giá trị cuối và số đo vào PR. Không vượt 0,02: cá sẽ trông như uốn dọc, sai dáng.

`uThick = 0.20`: bề dày cả hai mặt bằng 0,4 lần chiều cao cá. Với cá tỉ lệ 2:1, lúc nhìn thẳng mũi, bề ngang thấu kính ≈ 0,2·L. Bản nháp 1 dùng 0,12 nên chỉ ~0,12·L, trượt chính ngưỡng ≥ 20% mà bản nháp đó tự đặt.

Lưới 32×16 trên ô 256×128: mỗi ô lưới 8×8 px nguồn, nên viền thấu kính lệch tối đa ~8 px nguồn (~5 px màn ở cỡ cá 11%) lúc cá quay ngang hẳn. Chấp nhận được `[ƯỚC]`.

### 5.4 Fragment shader

```glsl
// fish.frag
precision highp float;
uniform sampler2D uColor;            // atlas màu, ĐÃ NHÂN ALPHA
uniform sampler2D uShape;
uniform sampler2D uCaustic;          // ô caustic bake (6.1), REPEAT, có mipmap
uniform sampler2D uScene;            // scene-map: R = độ sâu che, G = cát
uniform vec4 uSceneXform;            // sceneUv = gl_FragCoord.xy * xy + zw
uniform vec3 uCamPos, uLightDir;     // uLightDir đã chuẩn hóa, hướng VỀ phía nguồn sáng
uniform vec3 uKey, uAmbient, uRim, uFog, uAbsorb, uSandBounce;
uniform float uSurfaceY, uSandY, uGlassZ, uDepthRange, uFogPerUnit;
uniform float uCausticScale, uCausticGain, uSpec;
uniform vec4 uCausticScroll;         // xy lớp 1, zw lớp 2
in vec2 vUv; in vec3 vWorld; in vec3 vN; in vec3 vT; in float vSide;
out vec4 outColor;

void main() {
  vec4 tex = texture(uColor, vUv);
  if (tex.a < 0.02) discard;

  // Che bởi đá trong ảnh nền (mép mềm ~2% độ sâu).
  float myDepth = clamp((uGlassZ - vWorld.z) / uDepthRange, 0.0, 1.0);
  float sceneDepth = texture(uScene, gl_FragCoord.xy * uSceneXform.xy + uSceneXform.zw).r;
  float occ = smoothstep(-0.02, 0.02, sceneDepth - myDepth);
  if (occ <= 0.0) discard;
  tex *= occ;

  // Pháp tuyến: mặt cong của thân (vN, vT) + độ phồng (normal map).
  vec2 nxy = texture(uShape, vUv).rg * 2.0 - 1.0;
  vec3 nT = vec3(nxy, sqrt(max(1.0 - dot(nxy, nxy), 0.0)));
  vec3 Ng = normalize(vN), Tg = normalize(vT);
  vec3 Bg = cross(Ng, Tg) * vSide;                   // mặt sau: z đảo, x/y giữ nguyên
  vec3 N = normalize(Tg * nT.x + Bg * nT.y + Ng * nT.z);
  vec3 V = normalize(uCamPos - vWorld);

  float wrap = clamp(dot(N, uLightDir) * 0.6 + 0.4, 0.0, 1.0);   // sáng bọc, không đen hẳn
  float c = 0.0;
#ifndef LITE
  vec2 cp = vWorld.xz * uCausticScale;
  c = min(texture(uCaustic, cp + uCausticScroll.xy).r,
          texture(uCaustic, cp * 1.37 + uCausticScroll.zw).r);
  c *= smoothstep(-0.1, 0.7, N.y);                   // chỉ mặt hướng lên nhận caustic
#endif
  float nearSand = 1.0 - smoothstep(0.0, 1.5, vWorld.y - uSandY);
  vec3 light = uAmbient + uKey * (wrap + c * uCausticGain)
             + uSandBounce * nearSand * max(-N.y, 0.0);          // cát hắt sáng lên bụng cá
  vec3 col = tex.rgb * light;
#ifndef LITE
  col += tex.a * uSpec * uKey * pow(max(dot(N, normalize(uLightDir + V)), 0.0), 40.0) * 0.25;
#endif
  col += tex.a * uRim * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.35;   // viền sáng
  col *= exp(-uAbsorb * max(uSurfaceY - vWorld.y, 0.0));            // càng sâu càng mất đỏ
  float fog = 1.0 - exp(-uFogPerUnit * max(uGlassZ - vWorld.z, 0.0));
  col = mix(col, uFog * tex.a, fog);                                 // sương theo quãng nước sau kính
  outColor = vec4(col, tex.a);                                       // premultiplied
}
```

Mức Nhẹ biên dịch với `defines: { LITE: '' }`. Đặt uniform bằng 0 vẫn tốn lượt đọc texture, nên dùng define.

Thông số khởi điểm `[ƯỚC]`, duyệt bằng ảnh ghép:

| Uniform | Giá trị | Lý do |
|---|---|---|
| `uFog` | trung bình ảnh nền trong `fogSampleRect` | khớp màu nước của ảnh |
| `uFogPerUnit` | `−ln(0.55) / (D_back − D_front)` = 0,085 | cá sau cùng pha 45% màu nước, cá sát kính 0% |
| `uAbsorb` | (0,06; 0,02; 0,01) mỗi đơn vị | cột nước ~6,7 đơn vị → kênh đỏ ở đáy còn ~0,67 |
| `uKey` / `uAmbient` | lấy màu sáng nhất / tối vừa của vùng tia sáng trong ảnh, chia tỉ lệ để `uKey + uAmbient ≈ 1,1` | cá không cháy sáng hơn nền |
| `uRim` | `uFog` × 1,6 | viền sáng màu nước |
| `uSandBounce` | màu cát trung bình × 0,15 | |
| `uCausticGain` / `uCausticScale` | 0,5 / 0,35 mỗi đơn vị | |
| `uSpec` | 1 (Cao, Vừa) | |

**Sửa so với bản nháp 1** (đã kiểm từng dòng):
- Sương cũ `1 − exp(−(0.045 · dist)²)` lấy `dist` từ camera (~35–41 đơn vị) nên **mọi cá phủ sương ~92%**, cả cá sát kính. Sương phải tính theo quãng nước sau kính.
- `TBN` dùng trong fragment nhưng không được khai báo; `vNormalW` khai báo nhưng không được gán. Shader cũ không biên dịch được.
- Hấp thụ cũ (0,10; 0,035; 0,02) làm cá ở đáy tối hơn hẳn mảng cát sáng nhất ảnh ngay cạnh. Giảm xuống, thêm ánh cát hắt lên bụng.
- Ảnh màu chưa nhân alpha + mipmap thì mép cá viền đen, rõ nhất ở nét làm mờ (cọ blur là bắt buộc theo `design.md`).

### 5.5 Chuyển động tối thiểu

Chỉ đủ để thấy đồ họa: bơi lượn, quay chữ U, uốn thân.

| Mục | Quy tắc `[ƯỚC]` |
|---|---|
| Trạng thái | `cruise` hoặc `turn` |
| Cỡ cá | L sao cho cá ở giữa độ sâu dài 11% bề ngang khung nhìn; hệ số riêng mỗi cá 0,8–1,2 theo hash `id` |
| Cruise | yaw trong ±25° quanh 0 (bơi sang phải) hoặc quanh π (sang trái); pitch ±15°; tốc độ 0,25–0,6·L/s; đổi hướng mềm theo nhiễu riêng mỗi cá (seed theo `id`) |
| Vào `turn` | Khi còn < 1,5·L tới biên x của độ sâu đó, hoặc ngẫu nhiên mỗi 8–20 s |
| `turn` | yaw đi từ hướng cũ sang hướng mới trong **0,5–0,9 s**, nội suy `smoothstep`, **luôn đi qua yaw ≡ −π/2** (đầu hướng về camera, thấy góc 3/4 như gốc): phải → trái đi 0 → −π/2 → −π; trái → phải đi π → 3π/2 → 2π. Tốc độ giảm còn 60%, cá vẫn tiến nên vẽ thành cung |
| Roll | `−0.35 · yawRate`, kẹp ±0,4 rad |
| Sóng thân | `freq = 1.2 + 2.0 · speed/maxSpeed` Hz; `amp = 0.07` (theo L); `waves = 0.9`. Lúc `turn`: `freq × 1.5`, `amp × 1.4` |
| Nhấp nhô khi chậm | `y += 0.03·H·sin(0.8·t + seed)` |
| Biên z | `D_front` → `D_back`; đổi độ sâu chậm, tối đa 0,1·L/s |

Bản nháp 1 giới hạn `|vel.z| ≤ 0,45·|vel.x|`. Lúc quay chữ U, `vel.x` đi qua 0 nên luật này chặn đúng cú quay nó muốn có. Máy trạng thái ở trên thay luật đó.

Đặt hàm toán chung (uốn, quay, cỡ) trong `app/src/client/be/fish-math.ts`, viết lại y hệt trong GLSL, có unit test. Kiểm tra tự động (mục 10.3) dùng hàm này để tính vị trí trên màn mà không cần đọc điểm ảnh.

---

## 6. Nước

### 6.1 Caustic: bake một lần, đọc 2 lần mỗi điểm ảnh

Bản nháp 1 tính Voronoi thủ tục mỗi điểm ảnh: 2 lớp × 9 ô, mỗi ô 4 lần `sin` (hash + chuyển động), áp lên cát và thân cá. Với ~0,5 Mpx mỗi khung, ước tốn 3–6 ms GPU trên UHD 610 `[ƯỚC]`, tức nửa ngân sách. Hash `fract(sin(x)·43758)` còn dễ ra nhiễu sọc trên GPU Intel/ANGLE.

Thay bằng: **bake một ô caustic liền mạch 512×512** vào render target lúc khởi động (một lần, ~0,26 Mpx), rồi mọi nơi chỉ đọc texture 2 lần với hai tốc độ trượt khác nhau, lấy `min`.

```glsl
// caustic-bake.frag — chạy 1 lần vào RT 512×512 (R8 hoặc RGBA8), bật mipmap, wrap REPEAT
precision highp float;
in vec2 vUv; out vec4 outColor;
const float CELLS = 8.0;                       // số ô mỗi chiều; mod theo CELLS → liền mép
vec2 hash2(vec2 p) {                           // hash không dùng sin (Dave Hoskins)
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.xx + q.yz) * q.zy);
}
float cellEdge(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(float(x), float(y));
    vec2 o = hash2(mod(i + g, CELLS));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return d2 - d1;                              // ≈ 0 trên biên ô
}
void main() {
  float e = cellEdge(vUv * CELLS);
  float c = pow(clamp(1.0 - e * 2.2, 0.0, 1.0), 5.0);   // sợi sáng mảnh ở biên ô
  outColor = vec4(vec3(c), 1.0);
}
```

Chuyển động: `uCausticScroll.xy += (0.020, 0.012)·dt`, `uCausticScroll.zw += (−0.015, 0.018)·dt` (đơn vị ô/s) `[ƯỚC]`. Ghép `min` cho mạng sáng "chảy" như thủ tục. Mipmap tự làm mờ caustic ở xa.

Asset `caustics.*.png` trên nhánh v2 là các vệt mờ tròn, không phải mạng lưới sáng: **không dùng**.

### 6.2 Caustic trên cát

Ảnh nền đã có caustic tĩnh trên cát. Lớp động chỉ **làm sống** mảng đó, không vẽ mạng thứ hai sáng hơn.

```glsl
// sand.frag — quad phủ từ chân trời xuống đáy màn
precision highp float;
uniform sampler2D uCaustic, uScene;
uniform vec4 uSceneXform, uCausticScroll;
uniform vec2 uViewport;                          // kích thước canvas (pixel)
uniform float uTanHalfFov, uAspect, uHorizonNdc, uCamHeight, uCausticScale, uSandGain;
uniform vec3 uCamPos, uKey;
out vec4 outColor;
void main() {
  vec2 ndc = gl_FragCoord.xy / uViewport * 2.0 - 1.0;
  float dy = (uHorizonNdc - ndc.y) * uTanHalfFov;          // > 0 khi dưới chân trời
  if (dy <= 0.001) discard;
  float t = uCamHeight / dy;                               // khoảng cách tới điểm cát
  vec2 xz = vec2(uCamPos.x + t * ndc.x * uTanHalfFov * uAspect, uCamPos.z - t);
  float sand = texture(uScene, gl_FragCoord.xy * uSceneXform.xy + uSceneXform.zw).g;
  vec2 cp = xz * uCausticScale;
  float c = min(texture(uCaustic, cp + uCausticScroll.xy).r,
                texture(uCaustic, cp * 1.37 + uCausticScroll.zw).r);
  float a = c * sand * uSandGain;                          // uSandGain khởi điểm 0.18 [ƯỚC]
  outColor = vec4(uKey * a, a);                            // làm sáng về màu đèn, premultiplied
}
```

Công thức tia → mặt cát đúng với camera nhìn ngang có dịch ống kính (4.3). Bản nháp 1 viết `world.xz` cho cát nhưng nền là ảnh 2D, không có `world.xz`.

### 6.3 Bóng cá

- Quad instanced nằm trên mặt cát `y = sandY`, tâm dời theo hướng sáng: `shadowXZ = fish.xz − lightDir.xz / lightDir.y · height`, trong đó `height = fish.y − sandY`.
- Hình elip, trục dài = `L · (0.6 + 0.4·|cos yaw|)`, trục ngắn = `0.45·H`, xoay theo yaw trên mặt xz.
- Fragment: `r` = khoảng cách chuẩn hóa tới tâm; `a = 0.35 · (1 − clamp(height / 4, 0, 1)) · (1 − smoothstep(mix(0.2, 0.7, clamp(height / 4, 0, 1)), 1.0, r))`; nhân với mặt nạ cát `G`; bỏ nếu `R` của scene-map nói có đá đứng trước điểm bóng. Xuất `vec4(0, 0, 0, a)`.
- Ảnh gốc `goc-ca-phong-sang.jpg` cho thấy bóng mềm, rộng, nhạt. Không làm bóng sắc theo hình cá.

### 6.4 Bọt khí

Gốc (`goc-be-ui-bot.jpg`) là **một quầng sáng mờ dọc** với rất nhiều chấm nhỏ, vài bọt lớn hơn có viền. Ảnh nền của ta không có đá sủi: đặt nguồn **sau tảng đá bên phải** (`bubbleSourceUV`), ở độ sâu của tảng đá đó, để scene-map tự che chân cột.

| Thông số | Giá trị khởi điểm `[ƯỚC]` |
|---|---|
| Nhịp | phun theo xung mỗi 0,6 s, mỗi xung 7–11 bọt → **~15 bọt/s** (bản nháp 1 ghi 25 bọt/s nhưng xung 8–12 / 0,6 s chỉ ra ~17/s) |
| Bán kính trên màn | `r = 0.6 · (4.0/0.6)^(u²)` px, u ngẫu nhiên đều 0..1 → ~70% bọt nhỏ hơn 1,5 px |
| Nổi | `v = 30 + 22·r` px/s (theo px CSS ở độ sâu nguồn; đổi sang đơn vị thế giới bằng `pxToWorld(depth)`) |
| Lắc ngang | `x += A·sin(2π f t + φ)`, `A = 0.6r + 1` px, `f = 2.5 − 0.3r` Hz |
| Nở | `r *= 1 + 0.15 · tiếnĐộNổi` |
| Vỡ | chạm `surfaceV`: vòng nở 0 → 3r trong 120 ms rồi tắt |
| Quầng cột | 1 quad dọc rộng ~3% màn, gradient mềm, alpha 0,06 |
| Hạt lơ lửng | `gl.POINTS` 1–2,5 px, alpha 0,10–0,30, trôi chậm |

Fragment bọt (quad `vQuad ∈ [−1, 1]²`, `vRadiusPx` bán kính trên màn):

```glsl
float r = length(vQuad);
float ring = smoothstep(0.62, 0.86, r) * (1.0 - smoothstep(0.86, 1.0, r));   // viền phản xạ
float core = 0.08 * (1.0 - smoothstep(0.0, 0.9, r));                          // ruột gần trong suốt
float spec = 1.0 - smoothstep(0.0, 0.22, length(vQuad - vec2(-0.35, 0.35)));  // chấm phản sáng
float big = ring * 0.9 + core + spec * 0.9;
float dot_ = 0.7 * (1.0 - smoothstep(0.0, 1.0, r));                          // bọt nhỏ: chấm mềm
float a = mix(dot_, big, smoothstep(1.5, 2.5, vRadiusPx)) * vAlpha;
outColor = vec4(vec3(0.92, 0.97, 1.0) * a, a);
```

Bọt dưới 1,5 px không thể hiện được viền, nên vẽ thành chấm mềm. Quad phải lớn hơn bán kính 1 px để khử răng cưa.

### 6.5 Không làm

- Tia sáng: ảnh nền đã có. Không vẽ thêm.
- DOF, blur toàn màn, bloom: không.
- Mặt nước động: ảnh nền đã có gợn.

---

## 7. Đường lui Tĩnh (Canvas2D)

Dùng khi không có WebGL2, khi GPU là phần mềm, hoặc khi mức Nhẹ vẫn rớt khung. Sửa trên code v2:

1. Xóa 6 ellipse và 3 đường bezier (`tank.ts:459-487`).
2. Xóa `filter: blur()` cho từng cá (`tank.ts:569`).
3. DPR kẹp 1 thay vì 2 (`tank.ts:387`).
4. Nền chuyển sang `<img>` DOM như 4.2, bỏ `drawImage` nền mỗi khung (`tank.ts:441-448`).
5. Cắt sát sprite theo alpha; cá giữa bể dài 9–14% bề ngang.
6. Bóng elip mờ trên cát dưới mỗi cá (vẽ trước cá).
7. Tint theo độ sâu: nhân màu `(1 − 0.3·sâu, 1 − 0.1·sâu, 1)` thay vì phủ teal phẳng.
8. Bọt có viền (vẽ sẵn 3 sprite bọt cỡ khác nhau ra canvas phụ một lần, sau đó chỉ `drawImage`).

Mức này không có xoay 3D hay uốn thân, nên **không** được duyệt chuyển động bằng mức này.

---

## 8. Asset và công cụ

| Asset | Cách tạo | Công cụ |
|---|---|---|
| Ảnh lưới đo | Script vẽ lưới 5% (nhãn 0,05…0,95) chồng lên `hang-da-v2.png`, xuất `app/test-results/ao-ca/grid.png` để đọc tọa độ bằng mắt | `app/scripts/ao-ca-scene.mjs` (Playwright, canvas trong Chromium) |
| `scene-regions.json` | Đa giác từng tảng đá (tọa độ UV 0..1, 8–30 đỉnh, men theo mép đá đọc trên ảnh lưới) kèm độ sâu 0..1 mỗi tảng. Agent soạn tay bằng cách đọc ảnh lưới | Soạn tay, lưu trong repo |
| `scene-map.png` kênh R (độ sâu đá) | Rasterize đa giác: nền 255 (nước), mỗi đá tô xám phẳng `round(depth·254)`, khử răng cưa 1 px | `ao-ca-scene.mjs` |
| `scene-map.png` kênh G (cát) | Ngưỡng màu: điểm ảnh có độ sáng ≥ 0,55 và nằm dưới `horizonV`, trừ vùng đa giác đá; làm mờ 2 px | `ao-ca-scene.mjs` |
| `scene-calib.json` | Đọc chân trời, mặt nước, dải bóng trên ảnh lưới | Soạn tay |
| Ô caustic | Không có file, bake lúc chạy (6.1) | – |
| Cá mẫu kiểm thử | 8 PNG 480×240, đầu quay phải: tròn, dài mảnh, có lỗ, vây rời thân, nét làm mờ, cá đen, cá trắng, cá rất nhỏ. Sinh bằng **chính pad của app**: Playwright mở popup vẽ, chọn màu/cỡ cọ, kéo chuột theo đường định sẵn có rung nhẹ (seed cố định), dùng cả công cụ Làm mờ, rồi lấy `toPng()`. Đặt ở `app/tests/fixtures/ao-ca/` kèm script sinh lại | `app/scripts/ao-ca-fixtures.mjs` |
| Ảnh nền | Giữ nguyên. Có thể chuyển sang WebP không mất dữ liệu để giảm 2,6 MB PNG; điểm ảnh phải giống hệt | `cwebp -lossless` |

Kiểm tra asset: bản đồ R và G vẽ chồng lên ảnh nền ở 50% alpha, chụp lại, nộp cùng PR để Minh xem mép có khớp không.

---

## 9. Đo hiệu năng trên máy đích

Mục tiêu: thay mọi `[ƯỚC]` ở mục 3.3 và 5 bằng số đo. Không đo trên máy dev mạnh rồi suy ra.

### 9.1 P0: đo nền trước khi xây

Trang thử `#/chat?bench=gl` (chỉ build dev), mỗi kịch bản chạy 10 s, ghi trung bình và p90 thời gian khung:

| # | Kịch bản | Trả lời câu hỏi |
|---|---|---|
| B1 | Canvas trong suốt chỉ xóa nền, trên `<img>` nền | Chi phí ghép trang tối thiểu |
| B2 | B1 + 1 quad toàn màn đọc 2 texture | Chi phí một lớp toàn màn |
| B3 | Voronoi thủ tục của bản nháp 1 phủ dải cát | Xác nhận có nên bake |
| B4 | Caustic bake (6.2) phủ dải cát | So với B3 |
| B5 | 12 / 24 / 40 / 80 cá giả (shader 5.4, atlas thật) | Trần cá mỗi mức |
| B6 | B5 với 24 cá + nút có `backdrop-filter` | Mức Cao giữ blur nút nếu chênh ≤ 1 ms |
| B7 | Canvas đục vẽ cả nền | So với B1 (phương án dự phòng 4.2) |

Mỗi kịch bản chạy ở 1366×768 và 1920×1080, hệ số 1,0 / 0,75 / 0,5.

Để thấy độ dư thật, chạy bench **không khóa vsync**: Chrome mở bằng cờ `--disable-gpu-vsync --disable-frame-rate-limit` (kiểm cờ còn tác dụng trên bản Chrome đang dùng: số khung/giây phải vượt tần số quét). Chỉ dùng cho bench; người dùng thật chạy Chrome bình thường.

### 9.2 HUD đo trong app

`?perf=1` hiện góc trên trái (chỉ chữ, không che cá):

```
renderer, mức, kích thước canvas, hệ số, tần số quét đo được
fps, p50 / p90 / p99 ms khung, % khung rớt (cửa sổ 4 s)
số cá hiện / tổng, lệnh vẽ, tam giác, JS ao ms/khung
ms GPU (nếu có EXT_disjoint_timer_query_webgl2)
```

`window.__aoCa.perf()` trả cùng số liệu dạng JSON. Nút **"Sao chép số đo"** chép JSON vào clipboard (app đã chạy HTTPS).

### 9.3 Playwright trên máy đích

- Chạy trên **MAY3 ngoài giờ làm việc**, hoặc một máy văn phòng cùng cấu hình. `KIEN-TRUC-DE-XUAT.md` khuyên không chạy E2E trên MAY3 trong giờ vì máy đó là máy chủ.
- **Không dùng headless:** Chromium headless có thể dùng SwiftShader. Cấu hình `headless: false`, `channel: 'chrome'` hoặc `'msedge'` (trình duyệt người dùng thật dùng).
- Bước đầu tiên của test: đọc chuỗi renderer. **Nếu không chứa `UHD Graphics 610` (hoặc GPU thật của máy đó) thì test thất bại**, không ghi số.
- Kịch bản: mở `#/chat?golden=1&perf=1&fish=N&tier=T`, chờ 10 s cho ổn định, đo 60 s; N ∈ {8, 24, 40, 80}; T ∈ {cao, vua, nhe, auto}; hai cỡ cửa sổ. Thêm một lượt `tier=auto` 5 phút để xem mức tự chọn có dao động không.
- Ghi trace cho một lượt mỗi mức: `browser.startTracing(page, { screenshots: false, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'gpu'] })`, lưu `trace.json` để mở trong DevTools Performance.
- Xuất `perf-<máy>-<ngày>.json` vào `app/test-results/ao-ca/` (không commit), dán bảng tóm tắt vào PR.

### 9.4 Minh tự chạy trên MAY3 (không cần Playwright)

1. Mở `chrome://gpu`, chụp phần "Graphics Feature Status". WebGL2 phải ghi "Hardware accelerated".
2. Task Manager → Hiệu suất → Bộ nhớ: ghi "Khe đã dùng" (1 hay 2 thanh) và tốc độ RAM.
3. Mở `https://<máy chủ>/#/chat?perf=1&bench=auto`. Trang tự chạy B1–B6 rồi các cảnh 8/24/40 cá ở từng mức, khoảng 6 phút. Không chạm chuột trong lúc chạy.
4. Bấm **"Sao chép số đo"**, dán vào PR hoặc gửi cho agent.
5. Chạy lại bước 3 khi máy đang mở việc văn phòng thường ngày (Chrome nhiều tab, Zalo), ghi rõ "có tải".

### 9.5 Bảng kết quả (agent điền, không được bỏ cột)

| Máy | Renderer | RAM kênh | Màn | Mức | Cá | Hệ số | p50 ms | p90 ms | % rớt | JS ms | GPU ms | Có tải? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | | | |

Sau P0, cập nhật mục 3.3 bằng số thật và ghi nguồn số đo.

---

## 10. Nghiệm thu hình: không tự chấm

### 10.1 Cảnh vàng (golden)

- `#/chat?golden=1&seed=42`: RNG có seed (mulberry32), bước thời gian cố định 1/60 s, 8 cá mẫu từ `app/tests/fixtures/ao-ca/`, mức ép bằng `tier`.
- Hook chỉ có khi `golden=1`: `window.__aoCa = { advance(sec), state(), scenario(name), perf() }`.
- Kịch bản: `wide` (toàn bể), `closeup` (camera golden dí gần một cá, để so với `goc-ca-phong-sang.jpg`), `uturn` (một cá quay chữ U giữa bể), `depth` (cùng một cá ở sát mặt nước rồi sát cát; sát kính rồi sau cùng), `bubbles`.

### 10.2 Ảnh ghép và video

- Viewport 1366×768 và 1920×1080. Chụp `wide` tại t = 0, 2, 6 s; `uturn` tại t = 0, 0,35, 0,7 s; `closeup` t = 1 s.
- Quay video (`video: 'on'`) cho `wide` 10 s và `uturn`.
- Ghép bằng chính Playwright: một trang HTML tạm đặt hai `<img>` cạnh nhau (trái: ta, phải: gốc), chụp màn hình. Không cần cài ffmpeg.

| Ảnh ta | Ảnh gốc |
|---|---|
| `wide` | `goc-be-ui-bot.jpg` |
| `closeup` | `goc-ca-phong-sang.jpg` |
| `uturn` 3 khung | `goc-boi-t0/t05/t10.jpg` |
| `depth` | `goc-be-lua.png` |

- Kết quả ở `app/test-results/ao-ca/` (không commit), đường dẫn dán vào PR.

### 10.3 Kiểm tra tự động (trượt một mục thì không được nộp CHỜ DUYỆT)

| Kiểm tra | Ngưỡng | Cách đo |
|---|---|---|
| Ảnh nền không đổi | Ngoài mặt nạ cát và ngoài cá/bọt/bóng: chênh trung bình ≤ 1 mức, tối đa ≤ 3 mức so với ảnh nền render một mình | so điểm ảnh, ẩn các lớp động |
| Không vệt ngang toàn màn | Không hàng điểm ảnh nào có > 80% điểm lệch > 6 mức sáng so với trung bình hai hàng kề | ảnh `wide` |
| Cỡ cá | Cá ở giữa độ sâu dài 9–14% bề ngang khung nhìn | `fish-math.ts` chiếu khung cá |
| Chiều sâu | Cùng cá: chiều dài trên màn ở `D_back` / ở `D_front` trong 0,55–0,65 | `fish-math.ts` |
| Quay chữ U | 0,5–0,9 s; đi qua yaw −π/2; bề ngang nhỏ nhất trên màn ≥ 15% chiều dài lúc nhìn ngang | `state()` + `fish-math.ts` |
| Sóng thân đọc được | Lúc cruise với yaw 15–25°, đỉnh đuôi dịch trên màn (đỉnh-đỉnh) ≥ 3% chiều dài cá trên màn | `fish-math.ts` |
| Màu theo độ sâu | Cảnh `depth`: kênh R trung bình của cá sát cát thấp hơn sát mặt nước ≥ 15%; cá sau cùng gần màu `uFog` hơn cá sát kính ≥ 25% | điểm ảnh trong khung cá |
| Bóng | Cá cách cát < 2 đơn vị: độ sáng tâm bóng thấp hơn ≥ 8% so với cùng chỗ khi tắt bóng | 2 ảnh |
| Bọt | 12–18 bọt/s; số bọt sống không vượt trần của mức | `state()` |
| Lệnh vẽ | ≤ 7, không tăng theo số cá | `renderer.info` |
| Hiệu năng | Có bảng 9.5 từ máy đích; renderer đúng GPU thật; với 24 cá ở `tier=auto`, % khung rớt ≤ 5% ở cả hai cỡ màn | mục 9 |

### 10.4 Duyệt bằng mắt

Agent nộp: ảnh ghép, video, bảng 10.3, bảng 9.5. Ghi trạng thái `CHỜ DUYỆT`. Minh xem và ghi `ĐẠT` hoặc `CHƯA` kèm nhận xét. Agent có thể dùng skill `design:design-critique` để tự soi ảnh ghép **trước khi** nộp; kết quả tự soi không thay cho duyệt.

---

## 11. Lộ trình

| Pha | Nội dung | Qua pha khi |
|---|---|---|
| P0 | Bench `?bench=gl`, HUD `?perf=1`, đo trên MAY3 (9.1, 9.4) | Minh dán bảng số; agent cập nhật 3.3 bằng số thật theo luật ở `AO-CA-V3-HANDOFF.md` mục 5 |
| P1 | `scene-map.png`, `scene-calib.json`, dựng camera khớp ảnh, caustic bake + caustic cát, golden mode, cá mẫu | Ảnh chồng scene-map và ảnh `wide` không cá được duyệt |
| P2 | Worker tiền xử lý, atlas, cá instanced (5.2–5.4), chuyển động 5.5, bóng | Ảnh ghép `closeup`, `uturn`, `depth` + video được duyệt; kiểm tra 10.3 qua |
| P3 | Bọt, hạt, mức chất lượng tự chuyển, đo lại trên MAY3 | Bảng 9.5 đủ các mức; video `wide` được duyệt |
| P4 | Đường lui Tĩnh (mục 7) | Ảnh `wide` ở `tier=tinh` được duyệt |

P1 không cần số đo P0 nên bắt đầu ngay khi P0 đã nộp và đang chờ Minh đo. P4 không phụ thuộc P1–P3, làm song song nếu khác file.

Mỗi pha ghi quyết định mới vào `docs/THIET-KE.md` trong cùng PR (luật `agents.md`), gồm việc thêm three.js và phiên bản ghim. Khi tài liệu này được commit, thêm dẫn chiếu tới nó từ `docs/THIET-KE.md` mục 12.

---

## 12. Skill dự án đề xuất: `.claude/skills/ao-ca-render/SKILL.md`

- Kích hoạt khi sửa `app/src/client/be/**` hoặc khi nói về ao cá.
- Đọc tài liệu này trước; mở ảnh trong `.ref/drawquarium/` tương ứng hạng mục đang làm.
- **Mẫu cấm:** ellipse/đường toàn màn làm caustic; Voronoi thủ tục mỗi khung; `scale(−1, 1)` để quay đầu; cắt ảnh cá thành mảnh để vẫy đuôi; bọt không viền; `filter: blur()` cho từng cá; `backdrop-filter` trên ao ở mức Vừa/Nhẹ; vẽ ảnh nền trong WebGL khi chưa có số đo B7; `MeshStandardMaterial`, shadow map, `EffectComposer`; `antialias: true`; render quá 1× pixel CSS; `needsUpdate` cho cả atlas; đo hiệu năng bằng headless; cá < 8% bề ngang; ghi "ĐẠT".
- Lệnh nghiệm thu mục 10, lệnh đo mục 9, mẫu báo cáo nộp.

---

## Phụ lục A. Thay đổi so với bản nháp 1

| Bản nháp 1 | Vấn đề | Bản nháp 2 |
|---|---|---|
| Phạm vi gồm trình vẽ, thức ăn, tò mò, vuốt cá, đèn bể, chỉnh bể | Minh thu hẹp còn đồ họa | Chuyển ra ngoài phạm vi (mục 0) |
| Không có ngân sách hiệu năng; "≥ 50 fps, 20 cá" | Không nói đo thế nào, trên máy nào; bể thật cho tới 80 cá | Mục 3, 9: ngân sách theo mức, tự chuyển, bench P0, cách đo trên MAY3 |
| Caustic Voronoi thủ tục 9 ô × 2 lớp mỗi điểm ảnh, hash bằng `sin` | Ước 3–6 ms trên UHD 610; hash `sin` dễ sọc trên GPU Intel | Bake 1 lần, đọc 2 texture (6.1) |
| Sương `exp(−(0.045·dist)²)` theo khoảng cách camera | Mọi cá phủ ~92% sương | Sương theo quãng nước sau kính, cá sau cùng 45% |
| Shader màu cá dùng `TBN` chưa khai báo, `vNormalW` không gán | Không biên dịch | Shader đầy đủ, pháp tuyến hai mặt đã kiểm (5.3, 5.4) |
| `sin(k·s − uFreq·uTime + uPhase)` | Đổi tốc độ là đuôi giật | Pha tích phân trên CPU |
| Sóng thân lệch z, bóng theo uốn "có thể bỏ ở mức Vừa" | Nhìn ngang gần như không thấy sóng nếu thiếu pháp tuyến | Pháp tuyến theo độ dốc bắt buộc mọi mức; tùy chọn `uBendY` (chốt ở Phụ lục C) |
| Độ phồng đọc texture ở đỉnh lưới 24×6 | 7 hàng đỉnh quá thô, thấu kính méo | Lưới 32×16 / 24×12 / 16×8 theo mức |
| `h = sqrt(d/dMax)`, `+0.15·luminanceGradient` | Lộ nếp gãy trục giữa; "luminanceGradient" mơ hồ | Mái tròn + làm mờ; nét mực nổi có công thức rõ |
| `thick = 0,12·cao` nhưng kiểm tra quay U đòi ≥ 20% | Tự trượt kiểm tra của mình | `uThick = 0.20`, ngưỡng 15% |
| fov 32–38°, camera cách 2,2× bề rộng bể | Cá gần/xa chênh ~17%; bể không phủ màn; không khớp phối cảnh ảnh nền | Camera dựng từ chân trời và dải cát đo trên ảnh (4.3) |
| Cát dùng `world.xz` | Nền là ảnh 2D, không có `world.xz` | Tia → mặt cát từ chân trời đã hiệu chỉnh (6.2) |
| Tách nền 3 lớp, đá trước che cá | `design.md` cấm sửa nền; tách lớp tốn công, ít độ sâu | Một `scene-map` độ sâu: cá khuất sau đá ở mọi độ sâu, ảnh không đổi |
| `setPixelRatio(min(dpr, 1.5))` | Trên UHD 610 không nên vượt 1× | Ngân sách điểm ảnh theo mức, nền `<img>` giữ nét |
| Mỗi cá 2 lệnh vẽ (2 mặt), không nói instancing cho cá | 80 cá → 160 lệnh vẽ, sắp xếp phức tạp | Atlas + instancing, 1 lệnh cho mọi cá |
| Distance field "< 30 ms, CPU" | 80 cá trên luồng chính khựng ~1–2 s | Worker, cá hiện dần |
| `|vel.z| ≤ 0,45·|vel.x|` | Chặn chính cú quay chữ U | Máy trạng thái `cruise`/`turn`, đi qua yaw −π/2 |
| Bọt 25/s nhưng xung 8–12 mỗi 0,6 s | Hai con số không khớp; kiểm tra 20–40/s sẽ trượt | ~15/s, kiểm 12–18/s |
| Hấp thụ (0,10; 0,035; 0,02) | Cá ở đáy tối hơn cát sáng nhất ngay cạnh | (0,06; 0,02; 0,01) + ánh cát hắt |
| Ghép ảnh bằng ffmpeg | Thêm công cụ chưa cài | Playwright tự ghép |
| Không nói headless, GPU phần mềm | Đo trên SwiftShader là số vô nghĩa | Headed, kiểm chuỗi renderer, đường lui Tĩnh |
| Không nói `backdrop-filter` | Nút v2 làm mờ 12 px đè lên canvas động mỗi khung | Đo B6; tắt ở Vừa/Nhẹ (chốt ở Phụ lục C) |
| Đường Canvas2D: thêm thức ăn viên | Ngoài phạm vi; bỏ sót `blur()` từng cá và DPR 2 | Mục 7 |

## Phụ lục B. Còn phải đo trên máy đích

1. Chuỗi renderer WebGL, WebGL2 có tăng tốc phần cứng không, GPU có bị chặn không (`chrome://gpu`).
2. RAM chạy 1 hay 2 kênh, tốc độ RAM.
3. Độ phân giải, DPR và tần số quét màn hình người dùng.
4. Chi phí ghép canvas trong suốt so với canvas đục (B1, B7).
5. Thời gian một lớp toàn màn ở 768p và 1080p (B2).
6. Voronoi thủ tục so với caustic bake (B3, B4).
7. Trần cá mỗi mức: 12 / 24 / 40 / 80 cá (B5) → sửa bảng 3.3.
8. Chi phí `backdrop-filter` của nút trên ao (B6).
9. Thời gian tiền xử lý một cá trong Worker và cả 80 cá.
10. Thời gian biên dịch shader lần đầu.
11. Kích thước gói JS trước/sau khi thêm three.js; thời gian parse trên Pentium.
12. Mức `tier=auto` chọn với 24 cá ở hai cỡ màn, có dao động không, khi máy rảnh và khi có tải văn phòng.
13. Toạ độ chân trời, mặt nước, dải bóng trên ảnh nền (`scene-calib.json`).

## Phụ lục C. Các mục chốt ở bản 3

| Mục | Chốt | Lý do |
|---|---|---|
| Thư viện render | three.js `0.170.0`, ghim chính xác, chỉ `RawShaderMaterial` + `InstancedBufferGeometry` | Chi phí chạy ngang OGL/WebGL thuần với ~6 lệnh vẽ; agent ít viết sai nhất |
| Cá hiển thị tối đa | 40 / 24 / 12 / 8, cá dư đổi lượt 150 s, ưu tiên cá của người xem và cá mới thả (3.3) | Giữ khung hình UHD 610, mọi cá vẫn được thấy |
| `backdrop-filter` nút | Tắt ở Vừa/Nhẹ/Tĩnh; Cao giữ nếu B6 ≤ 1 ms | Làm mờ lại mỗi khung trên canvas động |
| `uBendY` | 0 mặc định; bật 0,012 → 0,02 chỉ khi kiểm tra sóng thân trượt | Có ngưỡng đo, không cần người duyệt riêng |
| Tạo `scene-map` | Đa giác soạn tay trong `scene-regions.json` + script rasterize bằng Chromium của Playwright | Agent không dùng được GIMP; không thêm Python/mô hình AI; tái tạo được |
| Cá mẫu kiểm thử | Sinh bằng pad thật qua Playwright, seed cố định | Đúng định dạng tranh người chơi, tái tạo được |
| Ghép ảnh, quay video | Playwright (thư viện, theo mẫu `app/scripts/e2e-live-chuc-nang.mjs`) | Đã có trong dự án; không cần ffmpeg |
| Nhánh, PR | Một nhánh `vpt/ao-ca-v3` từ `origin/vpt/ao-ca-v2-ui`, một PR nháp; Minh duyệt từng pha bằng comment | Một chỗ để xem toàn bộ, cổng duyệt rõ (handoff mục 2) |
| Số đo P0 khác ước tính | Agent sửa bảng 3.3 theo luật cố định ở handoff mục 5, không tự chọn số | Tránh agent nới ngưỡng cho dễ qua |

P1 (18/11/2026): [hiệu chỉnh Hang Đá, thông số caustic và cách giảm tải MAY3](AO-CA-V3-P1.md). G=1 dành cho đệm trong R/G để bảo toàn pixel ngoài cát khi phóng canvas; G=2–255 là cường độ ánh sáng. P1 giữ nền HTML và một lệnh vẽ caustic.
