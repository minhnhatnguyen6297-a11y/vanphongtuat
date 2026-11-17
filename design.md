# design.md — Chuẩn giao diện Văn phòng Tuất

Chuẩn thiết kế hiện hành của app **Hôm nay ăn gì?** (issue #9). Mọi màn mới hoặc sửa lại đều theo file này.

- **Nền tảng:** giao diện Văn phòng Tuất đã vào `main` tại `d08d1707907bef991fabc3ce10222061513d648a`. Viết file này trên `main` `64b7c7e8700a8334d89903cf524d81ee22c0f288`.
- **Tài liệu gốc (chi tiết từng màn):** [`design-toi-gian/mocks/DESIGN-VAN-PHONG-TUAT.md`](design-toi-gian/mocks/DESIGN-VAN-PHONG-TUAT.md)
- **Ảnh mẫu:** [Đăng nhập](design-toi-gian/mocks/01-dang-nhap.png) · [Bàn hôm nay](design-toi-gian/mocks/02-ban-hom-nay.png) · [Vòng quay](design-toi-gian/mocks/03-vong-quay.png) · [Tính tiền](design-toi-gian/mocks/04-tinh-tien.png)
- **Code đang dùng:** token và component nằm ở `app/src/client/styles.css`. File `app/public/styles.css` là bản sao lúc build.
- **Thay thế:** bảng màu ViaHe cũ trong `agents.md` (`#FFF4D6`, `#FFCF33`, `#1F5FD1`…) và `design-toi-gian/ViaHe-*.dc.html` không còn là chuẩn hình ảnh. Quy tắc nghiệp vụ, bảo mật và quyền trong `agents.md` vẫn giữ nguyên.

Trạng thái ghi theo 3 mức: **[ĐÃ CHỐT]** là đã quyết định và đã có trong code; **[CHỐT, CHƯA LÀM]** là đã quyết định nhưng chưa làm; **[ĐỀ XUẤT]** là chưa được duyệt.

---

## 1. Token màu [ĐÃ CHỐT]

| Token thiết kế | Biến CSS hiện có | Hex | Dùng cho |
|---|---|---|---|
| `desk` | `--cream` | `#FEECD6` | Nền workspace (mặt bàn) |
| `paper` | `--paper` | `#FDF7EB` | Phiếu, form, danh sách, ô chưa chọn |
| `ink` | `--ink` | `#13110F` | Chữ, viền, icon, bóng cứng |
| `marker` | `--yellow` | `#FFDA2E` | Vệt tiêu đề, mục đang chọn, tem DẪN ĐẦU |
| `highlight` | `--highlight` | `#FDE67F` | Dòng của mình, ghi chú, hover |
| `stamp` | `--red` | `#EF3C35` | Nút chính, chữ mực đặt trên nền đỏ |
| `stamp-dark` | `--danger` | `#C62828` | Lỗi, cảnh báo, chữ giấy đặt trên nền đỏ |
| `binder` | `--green` | `#145C34` | Thanh đầu trang, tem CHỐT, nút xác nhận |
| `link-blue` | `--blue` | `#1D63E1` | Thao tác phụ, liên kết, vòng focus |
| `desk-edge` | `--orange` | `#F7B280` | Cạnh bàn, phụ kiện minh họa |
| — | `--muted` | `#51453C` | Chữ phụ |

- **Cặp chữ/nền đạt ≥ 4,5:1:** mực/đỏ, mực/vàng, giấy/xanh lá, giấy/xanh dương, giấy/đỏ đậm. Không đặt chữ giấy lên nền `stamp` khi chữ nhỏ.
- **Ngoại lệ đã có:** `.hn-scene-illustrated` ghi đè 4 token (`#FDEEDC`, `#FDF5E7`, `#105B36`, `#F93630`) để khớp ảnh minh họa. Phần ghi đè này chỉ dùng trong scene minh họa. Màn khác không chép lại.
- **Quy tắc:** chỉ dùng biến CSS, không viết hex trực tiếp trong màn. Khi cần màu mới, thêm token vào bảng này trước.

## 2. Chữ [ĐÃ CHỐT]

| Vai trò | Font | Cỡ |
|---|---|---|
| Thương hiệu, tiêu đề màn | Bungee (`--font-display`) | 32–44 px, line-height 1,1 |
| Tiêu đề khung | Bungee | 16–20 px |
| Nhãn, nút, nội dung | Be Vietnam Pro (`--font-body`) | 14–16 px. Nhãn đậm 700–800, nội dung 500–600 |
| Giá, PIN, mã bàn, số liệu | JetBrains Mono (`--font-mono`) | 13–16 px. Tổng bill 28–32 px, căn phải |

- **Nguồn font:** font WOFF2 đóng gói local từ `@fontsource/*`. `app/scripts/build.mjs` chép font vào `app/public/fonts/`, thư mục này được gitignore. Không gọi Google Fonts lúc chạy.
- **Tiếng Việt:** mỗi font cần cả subset `vietnamese` lẫn `latin`.

## 3. Hình khối và nhịp [ĐÃ CHỐT]

- **Nhịp giãn cách:** 4 / 8 / 12 / 16 / 24 px.
- **Khung chính:** viền `--border` (3 px mực), bóng `--shadow` `5px 5px 0 #13110F`, bản lớn `--shadow-lg` 6 px. Bóng luôn cứng, không blur.
- **Ô nhập, chip:** viền 2 px, bo 6–8 px. Vùng nhập liệu dùng nền phẳng, không đặt texture.
- **Nút chính:** cao 44–48 px, có chữ, thêm icon khi icon giúp nhận ra nút. Khi nhấn, nút dịch 2 px xuống phải và bóng giảm theo.
- **Focus:** vòng `link-blue` 2 px, cách viền 3 px. Không bỏ focus.
- **Mép gập, góc vát** (`.hn-paper-fold`, `--fold`, `--cut`): chỉ dùng cho phiếu hoặc nút chính, mỗi vùng tối đa 1 điểm nhấn.
- **Tem trạng thái:** vàng cho DẪN ĐẦU, xanh lá cho CHỐT, đỏ đậm kèm nhãn cụ thể cho lỗi. Nút đang chạy giữ nguyên kích thước và đổi nhãn, ví dụ **ĐANG QUAY…**.

## 4. Bố cục app [ĐÃ CHỐT]

- **Khung tham chiếu:** 1366 × 768. Kiểm tra thêm ở 1920 × 1080. Không có thanh cuộn ngang.
- **Sau đăng nhập:** thanh đầu xanh `binder` gồm logo gọn và tài khoản. Bên phải là rail 60–62 px với 6 mục theo thứ tự Bàn, Quay, Tính tiền, Sổ ghi, Kho quán, Sảnh. Mục hiện tại có nền `marker` và `aria-current="page"`.
- **Nội dung:** đặt trong phiếu giấy. Tiêu đề và thao tác phụ ở hàng đầu. Danh sách dài cuộn trong phiếu, không cuộn cả trang.
- **Minh họa (Shiba, cây, sticker):** rõ ở màn đăng nhập, sau khi vào app thì thu nhỏ ra mép khung. Minh họa không được che dữ liệu hay thao tác.

## 5. Thành phần dùng chung

Màn mới phải dùng lại các thành phần này. Không dựng phong cách riêng cho từng màn.

| Thành phần | Trạng thái |
|---|---|
| Thanh đầu, rail, scene minh họa (`main.ts`, `ui/header.ts`) | [ĐÃ CHỐT] |
| Phiếu giấy và mép gập (`.hn-paper-fold`) | [ĐÃ CHỐT] |
| Nút chính/phụ, chip, tem | [ĐÃ CHỐT] |
| Gom các lớp trên thành bộ class chung (ví dụ `.hn-card`, `.hn-btn--primary`, `.hn-chip`) để Chat và Bể cá dùng chung | [CHỐT, CHƯA LÀM] |

## 6. Màn cần đồng bộ

| Màn | Hiện trạng trên `main` | Việc cần làm |
|---|---|---|
| Đăng nhập | Ô **Tên đăng nhập** và **PIN 6 số**. Thẻ chỉ chọn nhanh, không tự chọn người đầu. Đăng ký vào sảnh và nói cách đăng nhập lần sau. Sai tên/PIN, mất mạng, từ chối và quá số lần là bốn câu khác nhau. | [ĐÃ CHỐT] 17/11/2026 |
| Bàn hôm nay, Vòng quay, Tính tiền | Đã theo thiết kế, có scene minh họa (`route` là `ban`, `quay`, `tien`) | Giữ nguyên ở PR đăng nhập |
| Sổ ghi, Kho quán, Sảnh, Quyền | Đã dùng token, không có scene minh họa | Soát lại theo bảng trong tài liệu gốc, ghi lại chỗ còn lệch |
| **Phòng chat** | Ao phủ khung nhìn dưới thanh đầu và cạnh rail. Chat là ô góc phải dưới, thu gọn được. Tin dài cuộn trong ô, ô gửi nằm dưới log. | [ĐÃ CHỐT] Bố cục ao/chat trên nhánh sửa lỗi. Trả lời thụt vẫn chưa có. Không gửi file trong chat. |
| **Bể cá** | Đã vào `main` qua PR #11. Lượt này: ao chung (mỗi người thả cá của mình) và popup vẽ bán trong suốt. PR #7 và #8 không trộn. | [ĐÃ CHỐT] Bố cục và ao chung. Đồ họa chi tiết để task sau. |

## 7. Bể cá: ranh giới thiết kế

**[ĐÃ CHỐT] (Minh quyết định ngày 17/11/2026)**

- **Nền bể:** dùng nền đã duyệt (cát, đá, gỗ lũa, cây, tia sáng). Không sửa nền.
- **Tranh của người chơi:** cá do người dùng vẽ, giữ nguyên nét. Không thay bằng cá chân thật hay cá mẫu sẵn. Bộ cá bán thật đã tạo trước đây chỉ để tham khảo.
- **Khung quanh bể:** khung, nút và bảng của bể theo token Văn phòng Tuất: viền mực, bóng cứng, nút Bungee/Be Vietnam Pro. Bên trong bể được dùng ảnh tả thực, ngoài khung thì không.
- **Nhập ảnh cá từ ngoài:** chỉ nằm trong bộ vẽ cá. Không mở rộng thành gửi file trong chat.
- **Bộ vẽ:** chỉ vài công cụ cơ bản. Bắt buộc có cọ **làm mờ (blur)** theo vùng quét, kèm thanh cỡ cọ và độ mạnh.
- **Mẫu hình cá để tô/vẽ:** nét mực trên nền trong suốt, **đầu quay sang phải**, đuôi bên trái. Gợi ý "ĐUÔI" và mũi tên hướng bơi là lớp phụ, không in vào tranh.
- **Ảnh demo:** mọi ảnh phải ghi rõ "MOCK THIẾT KẾ" hay "ảnh chạy thật".

**[ĐỀ XUẤT] Chuyển động và nước** (rút từ trailer Drawquarium, chỉ để tham khảo)

- **Bơi:** cá bơi tới điểm đích, tăng tốc rồi giảm tốc dần khi gần tới. Đầu nghiêng theo hướng bơi, giới hạn ±30°.
- **Quay đầu:** co bề ngang tranh về 0 rồi mở theo hướng mới, khoảng 0,4–0,6 s. Không lật ảnh tức thì.
- **Đuôi và lúc đứng yên:** đuôi lắc nhẹ, cá bơi càng nhanh thì lắc càng nhanh. Khi đứng yên thì nhấp nhô.
- **Nước:** gợn ở mặt nước, mảng sáng trôi chậm, cột bọt, hạt lơ lửng, bọt khi thả cá mới. Cá ở xa nhỏ hơn, mờ hơn và ngả xanh.
- **Hiệu năng:** cần có trần, xem `docs/spec/drawquarium.md` trên nhánh PR #8.

## 8. Quy tắc khi sửa giao diện

1. Đọc file này trước, rồi đến tài liệu gốc.
2. Cần token hay thành phần mới thì cập nhật file này trong cùng PR.
3. PR giao diện kèm ảnh chạy thật ở 1366 × 768 và 1920 × 1080. Ảnh mock phải ghi rõ là mock.
4. Không đổi quy tắc nghiệp vụ, quyền hay bảo mật khi chỉ sửa giao diện.

## 9. Ao cá trên main

PR #11 đã đưa bể vào `main`. Nhánh sửa lỗi sau đó giữ nền đã duyệt và tranh người chơi.

- Ao phủ phần nội dung màn chat. Nút **Vẽ cá** mở popup bán trong suốt. Đóng hoặc Escape giữ nháp trên máy.
- Cá thả lên server rồi mọi phiên đang mở đều thấy. Không phải một canvas nhiều người cùng sửa.
- Chat là ô nhỏ góc phải dưới. Không còn hai thẻ song song và dải vẽ cố định.

## 10. Nhánh code `vpt/fish-tank-features`

Mục này ghi việc code đã bắt đầu. Không đổi các quyết định ở trên. Bản `design.md` đầy đủ lấy từ `vpt/design-assets`, chỉ thêm trạng thái.

- Phòng chat dùng phiếu giấy, viền mực, bóng cứng, font local. Ô soạn là textarea rộng. Ảnh cá không vào chat.
- Bể: nhập PNG/JPG/WebP (xem trước rồi đưa vào tranh), 6 mẫu outline tạm (đầu sang phải), bút, tẩy, màu, cỡ nét, hoàn tác, cọ mờ theo vùng, thả tranh người chơi. Nền là `app/public/art/be/` chép từ PR #7 commit `474626b`, không merge nhánh đó.
- Quay đầu trên nhánh này co bề ngang còn khoảng 0,05 rồi mở, trong 0,4–0,6 s. Nghiêng đầu nhân với hướng bơi, nên quay trái thì góc đổi dấu. Mục 7 đề xuất co về 0; phần đó vẫn là đề xuất.
- Chưa làm: trả lời thụt, soát Sổ/Kho/Sảnh/Quyền, bộ class chung ở mục 5.

## 11. Sảnh VP · lưới thẻ (PR02)

Bố cục lưới đều và tên theo chức năng là **[ĐÃ DUYỆT]** trong báo cáo 17/11/2026. Số đo lưới là **[ĐÃ ĐO]** trên app chạy thật ngày 18/11/2026 (Playwright, viewport đúng kích thước, một máy chủ HTTP tạm, hai phiên minh và lan). Ảnh tĩnh không chứng minh hiệu năng. Hình SVG vẫn là **[DỰ KIẾN]** cho đến khi Minh duyệt nét vẽ.

Đã đo, không cuộn ngang (`scrollWidth` = `clientWidth`):

| Khung | Cao trang | Đáy thẻ hàng dưới | Đáy dòng phụ | Kết quả |
|---|---|---|---|---|
| 1366×768 | 768 px, không cuộn | 740 px | trong thẻ, đáy thẻ dưới khung 28 px | Không cắt chữ, không cắt đáy thẻ |
| 1920×1080 | 1080 px, không cuộn | 1052 px | trong thẻ, đáy thẻ dưới khung 28 px | Không cắt chữ, không cắt đáy thẻ |

Hai phiên cùng máy chủ thấy cùng 8 nhãn và cùng `href`. Không đo trên hai máy vật lý.

Ảnh chạy thật: [1366×768](docs/review/2026-11-18-sanh-1366.png) · [1920×1080](docs/review/2026-11-18-sanh-1920.png).

| Mục | Cũ | Mới | Lý do | Chỗ chỉnh |
|---|---|---|---|---|
| Lưới | 4 hàng lẫn hành lang, cửa, cây. `min-height: min(68vh, 640px)`. Thẻ chat có `data-area="chat"` nhưng không có `grid-area`, nên rơi ra ngoài và bị cắt đáy ở 1366×768. | 4 cột khi khung ≥ 1100 px, 2 cột khi hẹp hơn. Khoảng cách 12 px. | Báo cáo: phòng xếp lộn xộn. Mỗi phòng một ô bằng nhau. | `.hn-floor` trong `app/src/client/styles.css` |
| Vừa màn 1366×768 | Trang cao hơn khung nhìn, thẻ dưới bị cắt. | Khi rộng ≥ 1100 px và cao ≥ 700 px: sảnh cao `100dvh`, `overflow: hidden`. Hàng chữ là `auto`. Hình nằm ô `minmax(36px, 1fr)`, cao SVG 72% ô, trần 120 px. | Giữ tên, co hình. Không cuộn ngang. | cùng khối CSS, `@media (min-width: 1100px) and (min-height: 700px)` |
| Tên đã duyệt | QUẦY VÒNG QUAY, KÉT TIỀN, PHÒNG CHAT (route `chat`) | **Vòng quay**, **Chia tiền**, **Bể cá**. Route id vẫn `chat`. | Demo ghi «Bể cá & chat». Chat chung là nút mọi màn, thuộc PR06, không gắn ở PR này. | `ROOMS` trong `screens/home.ts`. Chip màn `#/chat`: `titleChat` đổi `CHAT VP` → `BỂ CÁ`. Header chỉ vẽ chip đó. |
| Tên phòng còn lại | PHÒNG ĂN TRƯA, SỔ BÀN GIẤY, KHO THỰC PHẨM, PHÒNG GIẢI TRÍ, PHÒNG CHỦ XỊ | Bình chọn, Sổ ghi, Kho quán, Giải trí, Quyền | Báo cáo yêu cầu tên theo chức năng, không liệt kê từng phòng này. **[DỰ KIẾN]** | `ROOMS` |
| Rail phải | 6 mục đã chốt mục 4, trong đó «Tính tiền» và «Sảnh» | Giữ nguyên. Không thêm Chat. | Rail đã chốt. Nút Chat mọi màn là PR06. | `ui/rail.ts` không sửa |
| Hình | Icon 22 px chung nhiều phòng | Một SVG nội tuyến mỗi phòng. Không ảnh mạng, không filter, không blur, không hoạt hình. Cá trên thẻ đầu sang phải. | Máy yếu: không thêm request ảnh, không hiệu ứng nặng. Hình cụ thể là **[DỰ KIẾN]** cho đến khi Minh duyệt ảnh. | `ROOM_ART` trong `screens/home.ts`. Muốn nhẹ hơn: hạ `max-height: 120px` của `.hn-floor-room-art svg`. |
| Trang trí sàn | Hành lang, cửa, cây | Bỏ | Không phải phòng, chiếm một hàng và đẩy thẻ cuối khỏi khung. | Đã xóa `.hn-floor-hall`, `.hn-floor-door`, `.hn-floor-plant` |
