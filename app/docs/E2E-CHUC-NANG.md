# E2E chức năng LIVE — Roles / Chat / Sảnh

Ngày: 2026-11-12  
URL: `http://127.0.0.1:8443`  
Tài khoản: `minh` · PIN: `129954` (admin reset-pin)  
Lan (2P games): PIN `377515` (admin reset-pin)  
Runner: Playwright + Chrome channel · click thật · `node scripts/e2e-live-chuc-nang.mjs`  
Server: `HNG_DEV_HTTP=1 HNG_ORIGIN=http://127.0.0.1:8443` · client `npm run build` trước khi chạy

## Kết quả tổng

| Pass | Fail | Tổng |
|---:|---:|---:|
| 15 | 0 | 15 |

## Chi tiết

| Chức năng | Mục đích | Kết quả | Ghi chú |
|---|---|---|---|
| Login PIN | Đăng nhập username + PIN 6 số cookie session | **pass** | minh / PIN=129954 |
| Vote quán | Chọn quán trên bàn; tem ghế / DẪN ĐẦU cập nhật | **pass** |  |
| Countdown vote cosmetic | Hiện đếm ngược; hết giờ vẫn vote được | **pass** | before="VOTE HẾT GIỜ — vẫn vote được"; after="VOTE HẾT GIỜ — vẫn vote được"; voteAfter=1; ended=true |
| Gọi món | Gửi order.add từ ô ghi chú / GỌI | **pass** |  |
| Chat bàn | Gửi tin scope tableId; hiện trong panel | **pass** |  |
| QUAY NGAY (spin) | wheel.spin máy chủ; UI ĐANG QUAY → kết quả | **pass** | mid=ĐANG QUAY…; end=ĐANG QUAY… |
| Chat vòng quay | Gửi tin scope wheelId trên màn Quay | **pass** |  |
| Bill / split | Nhập bill + chế độ chia; hiện phần từng người | **pass** | setBill=true |
| Không nút Chụp màn hình | Màn tính tiền không còn chụp màn | **pass** |  |
| Avatar → Quyền | Mở #/quyen; ma trận tầng hiện được | **pass** |  |
| Kho: thêm vào bàn | Nút + VÀO BÀN → table.addShop | **pass** | shopId=shop6 |
| Kho: xóa quán | Tạo quán tạm rồi shop.delete (không đụng quán đang dùng) | **pass** | stillVisible=0 |
| Sảnh Caro | Tạo/vào phòng Caro + đặt 1 nước | **pass** | occupiedCells=225 |
| Game CÁ NGỰA | Tạo/vào/start + xúc xắc 1 lần | **pass** |  |
| Game TỈ PHÚ | Tạo/vào/start + xúc xắc 1 lần | **pass** |  |

## Ghi chú

- Không soft-pass: game chỉ **pass** khi tạo/vào/start và thao tác chơi được (đánh caro / xúc xắc).
- Xóa quán: chỉ xóa quán tạm E2E, không xóa quán seed đang trên bàn.
- Unit/server Task 6: `npm test` **59/59** (xem `NGHIEM-THU-ROLES.md`).
