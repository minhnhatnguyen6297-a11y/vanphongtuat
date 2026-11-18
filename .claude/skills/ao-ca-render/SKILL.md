---
name: ao-ca-render
description: Dùng TRƯỚC mọi việc liên quan ao cá / bể cá / Drawquarium trong vanphongtuat — sửa app/src/client/be/**, shader, caustic, bọt, chuyển động cá, hiệu năng ao, ảnh nền ao, hoặc nộp/duyệt một pha ao cá V3. Nạp tài liệu bắt buộc, luật cấm, công cụ, lệnh nghiệm thu và luật "không tự ghi ĐẠT".
---

# Ao cá V3: luật làm đồ họa

## 1. Đọc trước, theo thứ tự
1. `docs/AO-CA-V3-HANDOFF.md`: quy trình, pha hiện tại, công cụ, skill, mẫu nộp.
2. `docs/AO-CA-V3-KY-THUAT.md`: kỹ thuật, shader, ngưỡng (gọi là KT).
3. Ảnh gốc của hạng mục đang làm trong `D:\vanphongtuat\.ref\drawquarium\` (không commit). Mở ảnh bằng công cụ đọc ảnh trước khi code và trước khi nộp.

Nếu ba file docs không có trong checkout: dừng và báo, không làm theo trí nhớ.

## 2. Cổng duyệt
- Kiểm `gh pr view --comments` trên PR của nhánh `vpt/ao-ca-v3`. Chỉ sang pha P<n> khi có comment của Minh đúng chữ `P<n-1> ĐẠT` (ngoại lệ: handoff mục 2).
- Nộp bằng comment `CHỜ DUYỆT` theo mẫu handoff mục 8. **Không bao giờ ghi ĐẠT**, kể cả trong file docs, commit, mô tả PR.
- Không nới ngưỡng KT 10.3. Không đổi số trong KT 3.3 ngoài luật handoff mục 5.
- Trượt cùng một tiêu chí sau 2 lần sửa: dừng, nộp số đo + giả thuyết, hỏi.

## 3. Mẫu cấm (gặp trong code là sửa hoặc từ chối)
- Ellipse, đường bezier, dải toàn màn để giả caustic/khúc xạ.
- Voronoi/noise thủ tục chạy mỗi khung mỗi điểm ảnh. Caustic là texture bake 1 lần (KT 6.1).
- Hash `fract(sin(...) * 43758...)`.
- `scale(-1, 1)` hoặc co ngang để quay đầu cá. Quay bằng yaw 3D, mặt sau tự lật (KT 5.2).
- Cắt ảnh cá thành mảnh rồi xoay để vẫy đuôi. Uốn bằng vertex shader (KT 5.3).
- Pha sóng dạng `sin(k*s - freq*time)`; pha phải tích phân trên CPU.
- Sương theo khoảng cách camera; sương theo quãng nước sau kính (KT 5.4).
- Màu atlas chưa nhân alpha (viền đen khi có mipmap).
- Bọt không viền; mọi cá dồn về một điểm khi bấm.
- Canvas2D `filter: blur()` trong ao; `backdrop-filter` ở mức Vừa/Nhẹ/Tĩnh.
- Vẽ ảnh nền trong WebGL (trừ khi luật handoff mục 5 đã chuyển sang canvas đục); sửa điểm ảnh của `hang-da-v2.png`.
- three: `MeshStandardMaterial`, `MeshPhysicalMaterial`, đèn three, `shadowMap`, `EffectComposer`, `antialias: true`, `needsUpdate` cho cả atlas, render quá 1× pixel CSS.
- Đo hiệu năng bằng headless hoặc trên máy dev rồi dùng số đó để quyết.
- Cá giữa độ sâu ngắn hơn 8% bề ngang khung nhìn.
- Thêm chức năng ngoài phạm vi KT mục 0 (trình vẽ mới, thức ăn chìm, tò mò, vuốt cá, đèn bể…).

## 4. Công cụ
Đúng bảng handoff mục 3: `three@0.170.0` ghim chính xác; esbuild hiện có (splitting + dynamic import); Worker + OffscreenCanvas; `fish-math.ts` có test `tsx --test`; script Playwright `ao-ca-scene.mjs`, `ao-ca-fixtures.mjs`, `ao-ca-visual.mjs` theo mẫu `app/scripts/e2e-live-chuc-nang.mjs`. Không GIMP, Python, ffmpeg, mô hình AI, extension trình duyệt.

## 5. Skill đi kèm
- Lập kế hoạch pha: `superpowers:writing-plans`. Không brainstorm lại hướng.
- Toán, camera, bộ chuyển mức, luật đổi lượt cá: `superpowers:test-driven-development`.
- Lỗi hiển thị: `superpowers:systematic-debugging`.
- Tự soi ảnh ghép ta ↔ gốc: `design:design-critique` (so khối, ánh sáng, chuyển động, cỡ; không so tông nền). Kết quả không thay duyệt.
- Trước khi nộp: `superpowers:verification-before-completion`, rồi `superpowers:requesting-code-review`.

## 6. Lệnh nghiệm thu trước mỗi lần nộp
```bash
npm --prefix app run typecheck
npm --prefix app test
npm --prefix app run build
node app/scripts/ao-ca-visual.mjs --tier=cao --viewport=1366x768,1920x1080 --check
```
Dán nguyên đầu ra vào comment nộp. Có `FAIL` thì không nộp `CHỜ DUYỆT`.

## 7. Luật dự án vẫn áp
`agents.md`: tên biến/hàm tiếng Anh, nhãn UI và toast tiếng Việt ngắn; escape dữ liệu người dùng bằng `esc()`; Neo-Brutalism chỉ cho vỏ UI, không cho cảnh nước; không sửa `archive/`; quyết định mới ghi vào docs cùng PR.
