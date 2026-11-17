# Quyết định thiết kế ao cá V2

Nguồn ảnh: `renders/` trong thư mục này · Trạng thái chung: **đề xuất** (chưa duyệt / chưa đo) · Chưa code chức năng hay ghép app.

## Bố cục ngắm ao

| Mục | Giá trị | Đơn vị / phạm vi | Lý do | Trạng thái | Ảnh | Chỗ chỉnh / giảm tải |
|---|---|---|---|---|---|---|
| Khung nhìn | Bể phủ 100% viewport; không header, rail, bảng chú thích, dải cát ghép | Toàn màn | Theo ảnh chuẩn Minh bác V1 | đề xuất | A-ngam-ao-*, B-ngam-ao-* | Chưa triển khai |
| Nút nổi | 5 nút tròn ~44×44 px; nền `#091d2a` ~76% + blur 12px; viền mỏng | Góc: Vẽ/Cho ăn/Xua trái dưới; Menu phải trên; Chat phải dưới | Chỉ giữ vài UI gọn | đề xuất | A-ngam-ao-*, MENU-CHON-NEN-* | Giảm blur nút trước khi bỏ icon |
| Hướng A nền | Ảnh Minh «Hang Đá…» cover 50% 50%; tone phủ `#031725` ~24% | 1920×1080 và 1366×768 | Nền thật, tia sáng, không cát ghép | đề xuất | A-ngam-ao-*, A-nen-sach-* | Đổi file nền / bỏ tone |
| Hướng B nền | Nền đá/caustic Pexels 10498914; tone tương tự | 1920×1080 | Phương án so sánh song song | đề xuất | B-ngam-ao-*, B-nen-sach-* | Không gộp với A trước khi chọn |
| Chọn nền | Menu «Ảnh nền» + «Chọn ảnh từ máy» | Popup nhỏ dưới nút Menu | Cho phép đổi nền sau | đề xuất | MENU-CHON-NEN-* | Chưa code file picker |

## Popup vẽ

| Mục | Giá trị | Đơn vị / phạm vi | Lý do | Trạng thái | Ảnh | Chỗ chỉnh / giảm tải |
|---|---|---|---|---|---|---|
| Khung vẽ | Overlay tối + blur 9px; editor inset 40 px (24 px ở 1366) | Toàn popup | Tranh lớn, nền ao còn thấy | đề xuất | A-ve-lon-* | Giảm blur overlay trước |
| Công cụ | Cọ / Tẩy / Làm mờ; màu 6 swatch; cỡ cọ **28 px**; độ mạnh **35%** | Bên phải editor | Bộ công cụ gọn | đề xuất | A-ve-lon-* | Giảm mặc định cỡ/độ mạnh |
| Zoom UI | Nhãn «Vừa khung» / ± / kéo | Chỉ UI; không đổi kích thước ảnh gốc khi zoom | Theo V1 đã kiểm | đề xuất | A-ve-lon-* | Chưa triển khai |

## Bọt khí

| Mục | Giá trị | Đơn vị / phạm vi | Lý do | Trạng thái | Ảnh | Chỗ chỉnh / giảm tải |
|---|---|---|---|---|---|---|
| Phong cách | Ruột trong, phản sáng lệch, **không viền / không quầng / không chấm sao** | Mọi bọt | Tránh kiểu hoạt hình V1 | đề xuất | BOT-NUOC-CHI-TIET-* | Đổi atlas `assets/bubble-atlas.png` |
| Xa | Đường kính **2–3 px**; độ hiện **0,32–0,44** | Bọt xa trong cụm | Mờ, thưa | đề xuất | BOT-NUOC-CHI-TIET-* | Hạ opacity trước |
| Giữa / gần | **4–6 px** (hiếm 7–9); độ hiện **0,62–0,70** | Bọt gần điểm tương tác | Còn thấy nước xuyên | đề xuất | BOT-NUOC-CHI-TIET-* | Giảm max đường kính |
| Cùng lúc (khung sheet) | **26 bọt** · đường kính mẫu 2,3 / 3,2 / 4,1 / 5,8 / 7,5 px | Một khung tĩnh sau cho ăn | Gần mốc «~30» Minh nêu; tách với tổng sinh/lần | đề xuất | BOT-NUOC-CHI-TIET-*, code `eventBubbles` length 26 | **Giảm length 26 → 12–16** nếu máy yếu |
| Sinh mỗi lần cho ăn | **8–26** (chưa chốt một số) | Mỗi thao tác cho ăn | Phản hồi đủ, không suối liên tục | đề xuất | BOT-NUOC-CHI-TIET-* | Giảm trần sinh trước khi giảm cỡ |
| Xua | Cụm thưa, lệch hướng rời | Mỗi lần xua | Ít hơn cho ăn | đề xuất | CON-TRO-VA-CA-* | Giảm count trước |
| Thời gian tồn tại | **0,8–1,8 s** rồi tan | Mỗi bọt sự kiện | Không đọng lâu | đề xuất | BOT-NUOC-CHI-TIET-*, CON-TRO-* | Rút max lifetime |
| Ambient | Không suối bọt liên tục | Toàn cảnh | Giảm tải | đề xuất | A-ngam-ao-* | Giữ 0 ambient nếu máy yếu |

## Con trỏ / cá phản ứng

| Mục | Giá trị | Đơn vị / phạm vi | Lý do | Trạng thái | Ảnh | Chỗ chỉnh / giảm tải |
|---|---|---|---|---|---|---|
| Xoay thân | **0,25–0,6 s**; không phóng to sprite lúc quay | Mỗi lần đổi hướng | Nhịp tự nhiên | đề xuất | CON-TRO-VA-CA-* | Rút thời gian tween |
| Blur toàn cảnh khi ăn/xua | **Không** | Toàn màn | Giảm tải GPU | đề xuất | CON-TRO-VA-CA-* | Giữ tắt |
| Tái dùng atlas bọt | Có | Mọi sự kiện | Máy văn phòng | đề xuất | `bubble-atlas.png` | Giảm số sprite trong atlas |

## Lịch sử thay đổi

| Khi | Cũ → mới | Lý do |
|---|---|---|
| 2026-11-18 | V1 UI khung/header/cát → V2 full-bleed + nút nổi | Minh bác bố cục V1 |
| 2026-11-18 | Bọt vòng hoạt hình → bọt nhỏ trong 2–7,5 px | Minh: bọt chưa đạt |
| 2026-11-18 | Nền cũ → ảnh Minh + phương án B | Minh gửi Hang Đá; COS shortlist Pexels |
| 2026-11-18 | «~30 bọt/lần ăn» → ghi **26 cùng lúc** + **8–26 sinh/lần** (đề xuất) | Tách phạm vi; giữ khoảng gần 30 để giảm tải sau |

## Chưa có trong bộ này

- Cá demo vẫn kiểu V1 (phẳng/đơn giản) — chỉ placeholder; tranh cá người chơi vẫn là nguồn chính.
- Chưa đo FPS trên máy thật / máy yếu nhất.
- Chưa tích hợp app, DB, nhánh repo.
