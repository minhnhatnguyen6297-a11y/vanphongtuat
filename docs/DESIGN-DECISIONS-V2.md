# Quyết định thiết kế ao cá V2

V3 thay thế phần chuyển động/nước, xem [`AO-CA-V3-HANDOFF.md`](AO-CA-V3-HANDOFF.md) và [`AO-CA-V3-KY-THUAT.md`](AO-CA-V3-KY-THUAT.md).

Nguồn ảnh: chuẩn hướng A · Trạng thái chung: **đang triển khai vòng 3/3** (chrome ĐẠT ở `fcd2450`) · Thông số bọt hard-code trong `app/src/client/be/tank.ts`.

## Bố cục ngắm ao (giữ vòng 2)

| Mục | Giá trị | Đơn vị / phạm vi | Lý do | Trạng thái | Ảnh | Chỗ chỉnh / giảm tải |
|---|---|---|---|---|---|---|
| Khung nhìn | Bể 100% viewport; không header/rail/chữ giữa/dải cát | Toàn màn | Minh bác V1 | **ĐẠT** vòng 2 | A-ngam-ao-* | `tank.ts`, `styles.css` |
| 5 nút tròn | ~44×44; `#091d2a` 76% + blur 12px | Vẽ/Cho ăn/Xua · Menu · Chat | UI gọn | **ĐẠT** vòng 2 | A-ngam-ao-* | `mount.ts` FAB |
| Chat | Chỉ nút tròn; panel khi mở | Phải dưới | Bỏ thanh CHAT | **ĐẠT** vòng 2 | — | `.hn-chat-dock:not([open])` |
| Nền A | Hang Đá cover + tone `#031725` 24% | Toàn bể | Nền Minh | **ĐẠT** vòng 1 | hang-da-v2.png | `tank.ts` `BG_*` |

## Chuyển động / nước (vòng 3)

| Mục | Giá trị | Đơn vị / phạm vi | Lý do | Trạng thái | Ảnh | Chỗ chỉnh / giảm tải |
|---|---|---|---|---|---|---|
| Xoay thân | **0,25–0,6 s**; tuck ngang tối đa ~28% rộng; **không phóng** sprite | Mỗi đổi hướng | Drawquarium | **vòng 3** | clip/ảnh | `motion.ts` `TURN_MS_*`, `turnWidthScale` |
| Đuôi lắc | ~±9° · 7 Hz | Liên tục | Sống động | **vòng 3** | — | `tailWag` |
| Depth | scale 0,55–1,1; blur max **1 px**; tint 0,22; alpha ≥0,88 | Cá xa | Tránh vệt trắng mờ | **vòng 3** | — | `depthLook`; spawn depth ≥0,45 |
| Mẫu demo | SVG màu đặc (teal/cam/mint), mắt rõ | Pad | Thay outline kem mờ | **vòng 3** | — | `patterns.ts` |
| Khúc xạ | 6 ellipse caustic α≈0,14 + 3 đường sóng α≈0,10 | Toàn nền | Lấp lánh nhẹ | **vòng 3** | A-ngam | `tank.ts` `draw()` — giảm số vòng/α nếu máy yếu |
| Blur toàn màn ăn/xua | **Không** | — | Máy yếu | giữ | — | — |
| Cho ăn | Mọi cá `retarget` + quay thân; bọt **8–26**, cap 26 | Click | Con trỏ↔cá | **vòng 3** | ảnh cho ăn | `feedAt` / `retarget` |
| Xua | Bán kính 280 px; đẩy mạnh; quay thân; bọt **4–10** | Click | Rời điểm | **vòng 3** | ảnh xua | `scareAt` |
| Tốc độ bơi | ~92 px/s | Seek | Phản hồi rõ | **vòng 3** | — | `step` speedPx |

## Bọt khí (giữ hard-code)

| Mục | Giá trị | Chỗ chỉnh |
|---|---|---|
| Cap cùng lúc | 26 | `EVENT_BUBBLE_CAP` → 12–16 nếu yếu |
| Cho ăn / xua | 8–26 / 4–10 | `FEED_*` / `SCARE_*` |
| Cỡ / α | 2,3–7,5 px; xa 0,32–0,44; gần 0,62–0,70 | `BUBBLE_DIAMS`, `FAR/NEAR_ALPHA` |
| Life / ambient | 0,8–1,8 s · ambient 0 | `LIFE_*`, `AMBIENT_BUBBLES` |

## Lịch sử

| Khi | Cũ → mới | Lý do |
|---|---|---|
| 2026-11-18 v1 | Full-bleed + Hang Đá + bọt sự kiện | Triển khai A |
| 2026-11-18 v2 | Bỏ CHAT bar + chữ giữa; icon Cho ăn viên thức ăn | COS đối chiếu ảnh |
| 2026-11-18 v3 | Quay/đuôi rõ hơn; caustic nhẹ; feed/scare retarget; mẫu màu; depth ít blur | Kéo gần Drawquarium |

## File chỉnh

- `app/src/client/be/motion.ts` — quay, đuôi, depth
- `app/src/client/be/tank.ts` — caustic, feed/scare, bọt, tốc độ
- `app/src/client/be/patterns.ts` — demo màu rõ
- `app/src/client/be/mount.ts` / `styles.css` — UI vòng 2 (không đổi vòng 3)
- `docs/DESIGN-DECISIONS-V2.md` — nhật ký

## Không làm vòng này

- Schema DB / nuôi lâu dài
- Merge main / ui-overhaul
