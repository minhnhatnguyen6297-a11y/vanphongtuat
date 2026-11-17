# Quyết định thiết kế ao cá V2

Nguồn ảnh: chuẩn hướng A đính kèm · Trạng thái chung: **đang triển khai vòng 2/3** (vòng 1 đã push `ece0541`) · Thông số bọt đã hard-code trong `app/src/client/be/tank.ts`.

## Bố cục ngắm ao

| Mục | Giá trị | Đơn vị / phạm vi | Lý do | Trạng thái | Ảnh | Chỗ chỉnh / giảm tải |
|---|---|---|---|---|---|---|
| Khung nhìn | Bể phủ 100% viewport; không header, rail, bảng chú thích, dải cát ghép, **không chữ giữa màn** | Toàn màn | Theo ảnh chuẩn Minh bác V1 | **đã triển khai** vòng 2 | A-ngam-ao-* | `tank.ts` (bỏ fillText trống); `styles.css` `[data-scene=chat]` ẩn head/title/rail |
| Nút nổi | 5 nút tròn ~44×44 px; nền `#091d2a` ~76% + blur 12px; viền mỏng | Góc: Vẽ/Cho ăn/Xua trái dưới; Menu phải trên; Chat phải dưới — **không thanh chữ nhật** | Chỉ giữ vài UI gọn | **đã triển khai** vòng 2 | A-ngam-ao-* | `mount.ts` FAB; `styles.css` `.hn-fab*`; chat dock ẩn khi đóng |
| Icon Cho ăn | Viên thức ăn (ellipse), **không** icon người/cá | Nút Cho ăn | Tránh nhầm với hồ sơ | **đã triển khai** vòng 2 | A-ngam-ao-* | `mount.ts` `FAB.feed` |
| Chat | Chỉ nút tròn; panel hiện khi bấm FAB | Phải dưới | Bỏ thanh «▶ CHAT» | **đã triển khai** vòng 2 | A-ngam-ao-* / 01-ngam-ao lệch | `styles.css` `.hn-chat-dock:not([open]){display:none}` + ẩn `summary` |
| Hướng A nền | Ảnh Minh Hang Đá cover 50% 50%; tone phủ `#031725` ~24% | 1920×1080 và 1366×768 | Nền thật, tia sáng | **đã triển khai** vòng 1 | A-ngam-ao-* | `tank.ts` `BG_DEFAULT=/art/be/hang-da-v2.png` |
| Chọn nền | Menu «Ảnh nền Hang Đá» + «Chọn ảnh từ máy» | Popup dưới nút Menu | Đổi nền sau | **đã triển khai** vòng 1 | MENU-CHON-NEN-* | `mount.ts` menu + `tank.setBackground` |

## Popup vẽ

| Mục | Giá trị | Đơn vị / phạm vi | Lý do | Trạng thái | Ảnh | Chỗ chỉnh / giảm tải |
|---|---|---|---|---|---|---|
| Khung vẽ | Overlay tối + blur 9px; editor inset 40 px (24 px ở 1366) | Toàn popup | Tranh lớn, nền ao còn thấy | **đã triển khai** vòng 1 | A-ve-lon-* | `styles.css` `.hn-fish-pop`; `mount.ts` |
| Công cụ | Cọ / Tẩy / Làm mờ; màu 6 swatch; cỡ cọ **28 px**; độ mạnh ~**35%** | Bên phải editor | Bộ công cụ gọn | **đã triển khai** vòng 1 | A-ve-lon-* | `mount.ts` SWATCHES + defaults |
| Zoom UI | Nhãn «Vừa khung» / ± / kéo | Chỉ UI | Theo V1 | chưa | A-ve-lon-* | Chưa |

## Bọt khí (hard-code — giữ nguyên vòng 2)

| Mục | Giá trị | Đơn vị / phạm vi | Lý do | Trạng thái | Ảnh | Chỗ chỉnh / giảm tải |
|---|---|---|---|---|---|---|
| Phong cách | Ruột trong, phản sáng lệch, không viền / quầng | Mọi bọt | Tránh hoạt hình V1 | **đã triển khai** vòng 1 | BOT-NUOC-CHI-TIET-* | `tank.ts` `drawEventBubbles` |
| Xa | 2–3 px; opacity 0,32–0,44 | Bọt xa | Mờ, thưa | hard-code | BOT-NUOC-* | `FAR_ALPHA` / `BUBBLE_DIAMS` |
| Gần | 4–6 px (hiếm 7–9); 0,62–0,70 | Bọt gần | Còn thấy nước | hard-code | BOT-NUOC-* | cùng file |
| Cùng lúc | **26** (`EVENT_BUBBLE_CAP`) | Sau cho ăn | Gần mốc ~30 | hard-code | code | **Giảm 26→12–16** nếu máy yếu |
| Sinh/lần ăn | **8–26** | Mỗi cho ăn | Không suối liên tục | hard-code | code | `FEED_BURST_*` |
| Xua | 4–10, lệch hướng | Mỗi xua | Thưa hơn | hard-code | code | `SCARE_BURST_*` |
| Tồn tại | **0,8–1,8 s** | Mỗi bọt | Không đọng | hard-code | code | `LIFE_MIN/MAX` |
| Ambient | **0** | Toàn cảnh | Giảm tải | hard-code | A-ngam-ao-* | `AMBIENT_BUBBLES` |

## Con trỏ / cá

| Mục | Giá trị | Đơn vị / phạm vi | Lý do | Trạng thái | Ảnh | Chỗ chỉnh / giảm tải |
|---|---|---|---|---|---|---|
| Xoay thân | **0,25–0,6 s**; không phóng sprite | Đổi hướng | Nhịp tự nhiên | **đã triển khai** vòng 1 | — | `motion.ts` `TURN_MS_*`; `tank.ts` drawFish |
| Blur toàn cảnh ăn/xua | **Không** | Toàn màn | Giảm GPU | **đã triển khai** | — | không gọi filter fullscreen |

## Lịch sử thay đổi

| Khi | Cũ → mới | Lý do |
|---|---|---|
| 2026-11-18 | V1 UI khung/header/cát → V2 full-bleed + nút nổi | Minh bác bố cục V1 |
| 2026-11-18 | Bọt vòng hoạt hình → bọt nhỏ trong 2–7,5 px | Minh: bọt chưa đạt |
| 2026-11-18 | Nền cũ → ảnh Minh Hang Đá | Minh gửi nền |
| 2026-11-18 | «~30 bọt/lần ăn» → **26 cùng lúc** + **8–26 sinh/lần** | Tách phạm vi |
| 2026-11-18 vòng 2 | Thanh «CHAT» chữ lớn + chữ giữa màn + icon Cho ăn kiểu người → chỉ 5 FAB tròn, ao trống im, viên thức ăn | COS đối chiếu ảnh chạy thật vs A |

## File chỉnh chính

- `app/src/client/be/tank.ts` — nền, bọt, bỏ chữ trống
- `app/src/client/be/mount.ts` — FAB / popup / icon
- `app/src/client/be/motion.ts` — thời gian quay
- `app/src/client/styles.css` (+ `public/styles.css`) — full-bleed, FAB, ẩn chat bar
- `app/public/art/be/hang-da-v2.png` — nền A

## Chưa / vòng sau

- Zoom UI popup; đo FPS máy yếu; tinh chỉnh bơi/khúc xạ vs Drawquarium (vòng 3).
- Schema DB nuôi lâu dài — **không** làm ở vòng này.
