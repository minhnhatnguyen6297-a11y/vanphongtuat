# Handoff: ao cá V3 (đồ họa, máy yếu)

Ngày: 2026-11-18 · Người giao: Minh · Người nhận: agent lập trình (Claude Code, Codex, OMP…) · Trạng thái: **sẵn sàng giao**

File này nói **làm gì, theo thứ tự nào, dùng công cụ/skill nào, nộp gì, kiểm bằng gì**. Kỹ thuật chi tiết (shader, công thức, ngưỡng) nằm ở [`AO-CA-V3-KY-THUAT.md`](AO-CA-V3-KY-THUAT.md), gọi tắt là **KT**. Khi hai file lệch nhau, file này thắng về quy trình, KT thắng về kỹ thuật.

---

## 1. Mục tiêu trong một đoạn

Ao cá trong phòng chat phải trông như cá vẽ tay **có khối, sống trong nước có ánh sáng**: thân phồng, uốn khi bơi, quay chữ U qua góc 3/4, caustic chạy trên cát và trên thân cá, cá sâu ngả xanh, cá xa nhạt vào màu nước, bóng mềm trên cát, cột bọt có viền. Chạy được trên Pentium G6405 + Intel UHD 610. **Chỉ làm đồ họa.** Danh sách ngoài phạm vi: KT mục 0. Ảnh nền `hang-da-v2.png` giữ nguyên từng điểm ảnh.

Hiện trạng và lý do làm lại: KT mục 1. Ảnh so sánh: `.ref/drawquarium/so-sanh-tong-the.jpg` (trái là ta).

---

## 2. Nhánh, PR, cổng duyệt

| Mục | Quy định |
|---|---|
| Nhánh | `vpt/ao-ca-v3`, cắt từ `origin/vpt/ao-ca-v2-ui` (`8aafb89`) |
| PR | Một PR **nháp** vào `main`, mở ngay sau commit đầu. Mô tả PR có bảng tiến độ 5 pha (mẫu ở mục 8) |
| Commit đầu (P-setup) | Đưa 3 file từ checkout `D:\vanphongtuat` sang nhánh: `docs/AO-CA-V3-KY-THUAT.md`, `docs/AO-CA-V3-HANDOFF.md`, `.claude/skills/ao-ca-render/SKILL.md`. Sửa `.gitignore` dòng `.claude/` thành hai dòng `.claude/*` và `!.claude/skills/` để skill được commit. Thêm dẫn chiếu tới hai file docs trong `readme.md` (mục tài liệu) và trong `docs/DESIGN-DECISIONS-V2.md` (dòng đầu: "V3 thay thế phần chuyển động/nước, xem …") theo luật `agents.md` |
| Ảnh tham chiếu | `.ref/drawquarium/` chỉ có ở máy Minh, **không commit**. Agent chạy ở worktree khác thì đọc theo đường tuyệt đối `D:\vanphongtuat\.ref\drawquarium\` |
| Cổng duyệt | Hết mỗi pha, agent comment vào PR theo mẫu mục 8 và ghi `CHỜ DUYỆT`. **Chỉ sang pha sau khi Minh comment đúng chữ `P<n> ĐẠT`** (vd. `P1 ĐẠT`). Agent phải đọc comment PR (`gh pr view --comments`) để kiểm, không tự suy |
| Ngoại lệ chạy song song | P1 bắt đầu được khi P0 đã nộp và đang chờ Minh đo trên MAY3. P4 làm song song với P1–P3 nếu sửa file khác |
| Quyết định mới | Ghi vào KT Phụ lục C, và vào `docs/THIET-KE.md` mục 12 nếu file đó có trên nhánh. Không có thì ghi ở mục "Quyết định" của mô tả PR |

---

## 3. Bộ công cụ: dùng gì, không dùng gì

### 3.1 Dùng

| Việc | Công cụ | Ghi chú |
|---|---|---|
| Render ao | `three@0.170.0` (ghim chính xác, `npm i -E`) | Chỉ `WebGLRenderer`, `RawShaderMaterial` (`glslVersion: THREE.GLSL3`), `InstancedBufferGeometry`, `InstancedBufferAttribute`, `WebGLRenderTarget`, `PerspectiveCamera`, `DataTexture`/`CanvasTexture`. Kiểm chữ ký `copyTextureToTexture` của đúng bản 0.170 trong `node_modules/three/src` trước khi dùng |
| Đóng gói | esbuild hiện có (`app/scripts/build.mjs`) | Đổi client sang `entryPoints: { app: 'src/client/main.ts' }`, `outdir: 'public'`, `splitting: true`, `format: 'esm'`, `minify: true`, `chunkNames: 'chunks/[name]-[hash]'`. Renderer ao nạp bằng `import('./be/gl/renderer.js')`. Worker là entry riêng → `public/ao-ca-worker.js` (`new Worker('/ao-ca-worker.js', { type: 'module' })`). Kiểm `index.html` vẫn trỏ đúng `app.js`. Ghi kích thước gói trước/sau vào PR |
| Tiền xử lý cá | Web Worker + `OffscreenCanvas` + `createImageBitmap` | KT 5.1 |
| Toán dùng chung | `app/src/client/be/fish-math.ts` (TypeScript thuần) | Hàm chiếu, uốn, quay, cỡ, camera. GLSL viết lại y hệt. Test bằng `tsx --test` như các test hiện có, thêm file test vào script `test` trong `app/package.json` |
| Tạo asset cảnh | `app/scripts/ao-ca-scene.mjs` dùng `playwright` (Chromium có sẵn) để vẽ canvas | Sinh `grid.png`, `scene-map.png` từ `scene-regions.json` (KT 8). **Không** GIMP, Photopea, Python, mô hình AI |
| Cá mẫu | `app/scripts/ao-ca-fixtures.mjs` lái pad thật bằng Playwright | KT 8 |
| Ảnh ghép, video, kiểm tra tự động | `app/scripts/ao-ca-visual.mjs`, viết theo mẫu `app/scripts/e2e-live-chuc-nang.mjs` (thư viện `playwright`, không cần `playwright.config`) | Ghép bằng trang HTML tạm 2 `<img>`; video bằng `recordVideo`. Kết quả vào `app/test-results/ao-ca/` (thêm vào `.gitignore` nếu chưa có) |
| Đo hiệu năng | Trang `#/chat?bench=gl`, HUD `?perf=1`, `window.__aoCa.perf()` | KT 9. Đo trên máy dev chỉ để gỡ lỗi; **số dùng để quyết là số MAY3** |
| Gỡ lỗi WebGL | `gl.getError()` sau mỗi bước khởi tạo (chỉ build dev), `getShaderInfoLog`, `renderer.info.render.calls`, `WEBGL_debug_renderer_info` | Không cài extension trình duyệt |
| Xem app khi làm | Skill `run` hoặc preview trình duyệt dựng sẵn trong app Claude | Build client (`npm --prefix app run build`) rồi chạy `npm --prefix app run dev` |

### 3.2 Không dùng

`MeshStandardMaterial`, `MeshPhysicalMaterial`, đèn của three, `renderer.shadowMap`, `EffectComposer` và mọi pass hậu kỳ, `antialias: true`, PixiJS, Babylon, framework UI, Google Fonts/CDN lúc chạy, ffmpeg, GIMP/Photopea, Python, mô hình đoán độ sâu, Spector/extension, headless khi đo hiệu năng. Danh sách mẫu code cấm: skill `ao-ca-render`.

---

## 4. Skill: khi nào gọi cái nào

| Thời điểm | Skill | Cách dùng |
|---|---|---|
| Mở đầu **mọi** phiên làm ao cá | `ao-ca-render` (dự án) | Bắt buộc. Nạp luật cấm, đường dẫn tài liệu, lệnh nghiệm thu |
| Lập kế hoạch một pha | `superpowers:writing-plans` | Kế hoạch lưu ở `docs/superpowers/plans/ao-ca-v3-p<n>.md`. **Không** gọi `superpowers:brainstorming` để bàn lại hướng: hướng đã chốt ở KT |
| Thực hiện kế hoạch | `superpowers:executing-plans` (một agent) hoặc `superpowers:subagent-driven-development` (khi việc trong pha độc lập, vd. bench và HUD) | |
| `fish-math.ts`, dựng camera, chiếu chân trời, bộ chuyển mức chất lượng, luật đổi lượt cá | `superpowers:test-driven-development` | Viết test trước: KT 4.3 có sẵn ca kiểm "điểm (0,0,−100) chiếu ra `horizonNdc`" |
| Màn đen, cá mất, viền đen, nhấp nháy, sai mép che | `superpowers:systematic-debugging` | Ghi giả thuyết và bằng chứng vào PR, không sửa mò |
| Tự soi ảnh ghép trước khi nộp | `design:design-critique` | Đưa **ảnh ghép ta ↔ gốc** và danh sách "so khối, ánh sáng, chuyển động, cỡ; không so tông nền". Dán kết quả vào PR mục "Tự soi". Không thay cho duyệt |
| Trước khi comment `CHỜ DUYỆT` | `superpowers:verification-before-completion` | Chạy lại toàn bộ lệnh ở mục 7 trong phiên, dán đầu ra thật |
| Review code shader/hiệu năng | `superpowers:requesting-code-review` hoặc `/code-review` | Mỗi pha một lần, trước khi nộp |
| Kết thúc | `superpowers:finishing-a-development-branch` | Chỉ sau `P3 ĐẠT` và `P4 ĐẠT` |

Không có skill làm game/shader nào cài sẵn; kiến thức kỹ thuật nằm ở KT và skill `ao-ca-render`. Không dùng skill artifact, dataviz, frontend-design cho việc này.

### Chọn mô hình/effort cho agent

| Việc | Đề xuất |
|---|---|
| P1 (camera, caustic), P2 (shader cá, chuyển động) | Mô hình mạnh nhất, effort cao. Đây là chỗ quyết định độ đẹp |
| P0 (bench, HUD, build), P3 (bọt, bộ chuyển mức), P4 (Canvas2D) | Mô hình thường, effort trung bình |
| Soạn `scene-regions.json` | Mô hình đọc ảnh tốt; phải nộp ảnh chồng để Minh xem mép |

---

## 5. Luật biến số đo P0 thành bảng mức (KT 3.3)

Agent áp đúng luật, **không chọn số theo cảm tính và không nới ngưỡng**. Số lấy từ lượt "có tải" trên MAY3 ở 1366×768; lượt 1920×1080 dùng để kiểm hệ số.

| Kết quả đo | Hành động |
|---|---|
| Trần cá mỗi mức | Mức X nhận số cá lớn nhất N ∈ {8, 12, 24, 40, 80} mà p90 khung ≤ 1,1 × target và % rớt ≤ 2%. Nếu N nhỏ hơn bảng hiện tại thì hạ; lớn hơn thì **giữ** bảng hiện tại |
| Nhẹ không đạt nổi 12 cá | Hạ ngân sách điểm ảnh của Nhẹ còn 0,25 Mpx, đo lại. Vẫn không đạt: Nhẹ còn 8 cá |
| B1 (canvas trong suốt rỗng) p50 > 4 ms **và** B7 (canvas đục có nền) nhanh hơn B1 ≥ 1 ms | Đổi sang canvas đục vẽ nền (KT 4.2 phương án dự phòng); chạy lại kiểm tra "ảnh nền không đổi" với ngưỡng tối đa 3 mức |
| B6 − B5(24 cá) > 1 ms | Tắt `backdrop-filter` cả ở mức Cao |
| B3 − B4 < 0,5 ms | Vẫn dùng caustic bake (rẻ hơn ở cá, ổn định hơn trên Intel) |
| Biên dịch shader tổng > 1,5 s | Hiện nền + cá sprite phẳng của mức Tĩnh trong lúc chờ, rồi mờ dần sang WebGL |
| Worker > 30 ms/cá | Hạ ô atlas còn 192×96, lưới Cao còn 24×12 |
| Renderer là SwiftShader/Basic trên MAY3 | Dừng P1–P3, báo Minh kèm ảnh `chrome://gpu`; chỉ làm P4 tới khi xử lý xong driver |

Sửa bảng KT 3.3, đổi nhãn `[ƯỚC]` của ô đã đo thành `[ĐO <ngày>, MAY3]`, ghi lượt đo nguồn.

---

## 6. Các pha

Mỗi pha: việc phải làm → sản phẩm → tiêu chí. **Trượt một tiêu chí thì không được ghi `CHỜ DUYỆT`.** Không đạt sau 2 lần sửa: dừng, nộp số đo + giả thuyết, hỏi Minh. Không đổi ngưỡng.

### P-setup (30 phút)
- Việc: mục 2 (nhánh, PR nháp, 3 file, `.gitignore`, dẫn chiếu).
- Tiêu chí: `git ls-files .claude/skills/ao-ca-render/SKILL.md` có kết quả; PR nháp mở với bảng tiến độ.

### P0: đo nền (KT 9.1, 9.2, 9.4)
- Việc: thêm `three@0.170.0`; đổi build (mục 3.1); khung renderer rỗng nạp bằng `import()`; phát hiện GPU phần mềm (KT 4.5); trang `?bench=gl` chạy B1–B7; `?bench=auto` chạy tự động ~6 phút; HUD `?perf=1` + nút "Sao chép số đo"; khung bộ chuyển mức (chưa cần đúng ngưỡng).
- Sản phẩm: bảng kích thước gói trước/sau; một lượt `?bench=auto` trên máy dev (đánh dấu "máy dev, không dùng để quyết"); hướng dẫn 5 bước KT 9.4 dán vào comment PR cho Minh.
- Tiêu chí:
  - `npm --prefix app run typecheck`, `npm --prefix app test`, `npm --prefix app run build` qua.
  - Mở `#/chat` không có `bench/perf`: ao v2 vẫn chạy như cũ (chưa thay renderer).
  - Chạy Chromium ép GPU phần mềm (`args: ['--use-angle=swiftshader']`): HUD phải hiện chuỗi renderer chứa `SwiftShader` và trang chọn Tĩnh (chứng minh phát hiện hoạt động). Chạy lại không có cờ đó trên máy dev: trang không được chọn Tĩnh.
  - `app.js` không chứa three (three nằm trong chunk riêng): kiểm bằng `grep -c "WebGLRenderer" public/app.js` = 0.
- Dừng: comment `CHỜ DUYỆT P0` + nhờ Minh chạy KT 9.4. Được bắt đầu P1. Khi có số MAY3: áp mục 5, commit, comment lại.

### P1: cảnh và nước (KT 4.3, 6.1, 6.2, 8, 10.1)
- Việc: `ao-ca-scene.mjs` → `grid.png`; soạn `scene-regions.json` và `scene-calib.json` từ ảnh lưới; sinh `scene-map.png`; dựng camera khớp ảnh (TDD); caustic bake + quad caustic cát; chế độ golden (`?golden=1&seed=42`, `window.__aoCa`); `ao-ca-fixtures.mjs` sinh 8 cá mẫu; khung `ao-ca-visual.mjs`.
- Sản phẩm: ảnh chồng scene-map 50% lên nền (R và G riêng); ảnh `wide` không cá ở 1366×768 và 1920×1080; 8 PNG cá mẫu; video 10 s caustic.
- Tiêu chí (KT 10.3): "Ảnh nền không đổi", "Không vệt ngang toàn màn", "Lệnh vẽ ≤ 7"; unit test chiếu chân trời qua; caustic cát chỉ xuất hiện trong mặt nạ G (so ảnh bật/tắt lớp, vùng ngoài G chênh ≤ 1 mức).

### P2: cá (KT 5, 6.3)
- Việc: Worker tiền xử lý; atlas 2 texture, `texSubImage2D` từng ô; cá instanced hai mặt; vertex/fragment shader KT 5.3–5.4; chuyển động KT 5.5; bóng KT 6.3; che bởi đá qua scene-map; luật đổi lượt cá KT 3.3 (TDD); nút Cho ăn/Xua giữ tối thiểu (KT 0).
- Sản phẩm: ảnh ghép `closeup`, `uturn` (3 khung), `depth`, `wide` có 8 cá; video `wide` 10 s và `uturn`; giá trị `uBendY` cuối cùng.
- Tiêu chí (KT 10.3): "Cỡ cá", "Chiều sâu", "Quay chữ U", "Sóng thân đọc được", "Màu theo độ sâu", "Bóng", "Lệnh vẽ", cộng các tiêu chí P1 vẫn qua. Thêm: không cá nào có viền đen quanh nét làm mờ (cá mẫu "nét làm mờ", so điểm ảnh mép với nền: không có điểm nào tối hơn cả cá lẫn nền > 10 mức).

### P3: bọt, hạt, chuyển mức (KT 6.4, 3.4)
- Việc: cột bọt + quầng, bọt sự kiện của Cho ăn/Xua dùng chung hệ bọt; hạt lơ lửng; bộ chuyển mức đầy đủ (TDD với chuỗi thời gian khung giả); đo lại trên MAY3 (Minh chạy).
- Sản phẩm: video `bubbles` 10 s; bảng KT 9.5 đủ mọi mức; log 5 phút `tier=auto`.
- Tiêu chí: "Bọt", "Hiệu năng" (KT 10.3); test bộ chuyển mức: chuỗi khung toàn 16,7 ms không hạ mức; 10% khung 40 ms trong 8 s thì hạ; không lên/xuống quá 3 lần trong 5 phút giả lập.

### P4: đường lui Tĩnh (KT 7)
- Việc: 8 mục KT 7 trên Canvas2D.
- Sản phẩm: ảnh `wide` ở `tier=tinh`.
- Tiêu chí: `grep "filter = " app/src/client/be/` không còn `blur(` trong ao; DPR kẹp 1; "Ảnh nền không đổi", "Không vệt ngang", "Cỡ cá" qua ở `tier=tinh`.

---

## 7. Lệnh kiểm phải chạy trước mỗi lần nộp

```bash
npm --prefix app run typecheck
npm --prefix app test
npm --prefix app run build
node app/scripts/ao-ca-visual.mjs --tier=cao --viewport=1366x768,1920x1080 --check
```

`--check` chạy các kiểm tra KT 10.3 của pha hiện tại, in bảng `PASS/FAIL` kèm số đo, thoát mã khác 0 nếu có `FAIL`. Dán nguyên đầu ra vào comment PR.

---

## 8. Mẫu

### Bảng tiến độ trong mô tả PR

```markdown
| Pha | Trạng thái | Comment nộp | Duyệt |
|---|---|---|---|
| P-setup | xong | – | – |
| P0 | CHỜ DUYỆT | <link> | |
| P1 | đang làm | | |
| P2 | chưa | | |
| P3 | chưa | | |
| P4 | chưa | | |
```

### Comment nộp một pha

```markdown
## P<n> — CHỜ DUYỆT

**Đã làm:** <3–6 gạch đầu dòng, mỗi dòng một thay đổi>

**Kiểm tra tự động** (`ao-ca-visual.mjs --check`, chạy lúc <giờ>):
<dán nguyên bảng PASS/FAIL>

**Ảnh ghép / video:** <đường dẫn trong app/test-results/ao-ca/>

**Số đo:** <bảng KT 9.5 nếu pha có đo; ghi rõ máy dev hay MAY3>

**Tự soi (design:design-critique):** <3–5 ý, mỗi ý chỉ chỗ trong ảnh>

**Chưa làm / còn lệch:** <liệt kê thật; "không có" chỉ khi đúng là không có>

**Quyết định mới:** <nếu có, kèm lý do; đã ghi vào KT Phụ lục C>
```

---

## 9. Brief dán cho agent

Dán nguyên khối dưới đây, đổi `<n>`:

```text
Bạn làm pha P<n> của ao cá V3 trong repo vanphongtuat, nhánh vpt/ao-ca-v3.
1. Gọi skill ao-ca-render trước mọi việc.
2. Đọc docs/AO-CA-V3-HANDOFF.md (quy trình) và docs/AO-CA-V3-KY-THUAT.md (kỹ thuật).
   Ảnh gốc để đối chiếu: D:\vanphongtuat\.ref\drawquarium\ (không commit).
3. Kiểm comment PR: pha trước phải có comment "P<n-1> ĐẠT" của Minh (trừ P-setup, P0, và P1/P4 theo ngoại lệ ở mục 2).
4. Làm đúng mục 6 / P<n> của handoff. Công cụ theo mục 3, skill theo mục 4.
5. Trước khi nộp: chạy mục 7, tự soi bằng design:design-critique, rồi comment theo mẫu mục 8.
   Ghi CHỜ DUYỆT. Không bao giờ ghi ĐẠT. Không nới ngưỡng. Kẹt 2 lần thì dừng và hỏi.
```
