# Quy chuẩn test ngắn — Hôm Nay Ăn Gì?

Tài liệu này để người làm sản phẩm (không cần là QA chuyên nghiệp) biết **test cái gì, tới mức nào, và ghi lỗi ra sao**. Áp dụng cho app Văn Phòng Tuất.

## 1. Ba mức test

| Mức | Hỏi gì | Ví dụ ở app này | Ai chạy |
|---|---|---|---|
| **Unit** | Một hàm đúng không, không cần trình duyệt? | `split()` chia tiền bội 500đ; parse tên Maps | `npm test` trong `app/` |
| **Integration** | Vài phần nói chuyện với nhau đúng không? | Đăng nhập → cookie → lệnh ghi SQLite → WebSocket đẩy cho người khác | Test server trong `app/tests/server/` |
| **E2E** | Người dùng bấm trên trình duyệt thật thì luồng có khép không? | Kê bàn → vote → chốt quán → gọi món → tính tiền | Playwright, hoặc ngồi bấm tay |

Unit không thay e2e. E2E không thay unit. Lỗi “không có nút chốt quán” chỉ lộ khi **dùng như người thật** (e2e / khám phá), vì từng hàm vẫn có thể đúng.

Nguồn: mức test trong ISTQB Certified Tester Foundation Level — [istqb.org](https://www.istqb.org/certifications/certified-tester-foundation-level).

## 2. Exploratory testing và session charter

Không viết sẵn từng click. Mỗi **phiên** có một nhiệm vụ (charter): trong một khoảng ngắn, khám phá một vùng, ghi những gì đã làm và những gì gãy.

Một charter gồm:

- **Nhiệm vụ:** ví dụ “Xem vote quán có kết thúc được không”.
- **Người / dữ liệu:** Minh và Lan cùng một bàn.
- **Không làm:** không sửa code, không đụng DB thật của văn phòng.
- **Ghi lại:** bước, kết quả, ảnh.

Nguồn: Jonathan Bach, *Session-Based Test Management* — [satisfice.us/articles/sbtm.pdf](https://www.satisfice.us/articles/sbtm.pdf).

## 3. Bộ gợi ý khi không biết bấm gì tiếp

Đừng chỉ đi “đường vui” (happy path). Mỗi màn, lần lượt hỏi:

| Gợi ý | Câu hỏi | Ví dụ |
|---|---|---|
| **SFDPOT** | Cấu trúc, chức năng, dữ liệu, nền tảng, vận hành, thời gian | Vòng quay trên Chrome điện thoại; quay lúc mạng chậm |
| **CRUD** | Tạo, xem, sửa, xóa, và xóa cái đang được chỗ khác dùng | Xóa quán đang nằm trong bàn đang vote |
| **Biên** | Rỗng, 1, rất dài, đúng giới hạn, vượt giới hạn | PIN 5 số, 6 số, 7 số; tên quán 80 ký tự |
| **Trạng thái** | Đang mở → đang khóa → xong. Có đường nào kẹt giữa chừng? | Vote mãi không chốt; quay xong không gắn được quán |
| **Ngắt** | F5, nút Back, bấm đúp, đóng tab giữa chừng | F5 khi vòng đang quay |
| **Nhiều người** | Hai ba người cùng lúc | Minh chốt quán lúc Lan vừa vote |
| **Mạng** | Chậm, rớt, tải lại | Tắt mạng rồi bấm Gọi |
| **Màn hình** | Desktop ~1366px và điện thoại 390px | Rail che mất nút |

SFDPOT là mô hình chiến lược test của James Bach (Heuristic Test Strategy Model): Structure, Function, Data, Platform, Operations, Time. Giới thiệu: [developsense.com — Heuristic Test Strategy Model](https://www.developsense.com/resources.html).

Giá trị biên và chuyển trạng thái là kỹ thuật thiết kế test trong cùng syllabus ISTQB ở mục 1.

## 4. Mười nguyên tắc dùng được của Nielsen

Khi một chỗ “không sai kỹ thuật” nhưng người dùng bí, đối chiếu:

1. Hệ thống có báo đang làm gì không (đang quay, đã lưu).
2. Chữ trên màn có giống việc đời thường không.
3. Có lối thoát / hoàn tác không (Back, hủy, đăng xuất).
4. Cùng một việc thì cùng một kiểu nút.
5. Có chặn được thao tác nhầm không (bấm đúp, xóa nhầm).
6. Việc cần nhớ có hiện ra sẵn không, hay phải nhớ PIN / tên quán.
7. Người dùng quen có đường tắt không.
8. Màn có đang rối, chữ đè chữ không.
9. Khi lỗi, có nói cách sửa không.
10. Chỗ khó có một câu hướng dẫn không.

Nguồn: Jakob Nielsen, *10 Usability Heuristics for User Interface Design* — [nngroup.com](https://www.nngroup.com/articles/ten-usability-heuristics/).

## 5. Mức nặng và thứ tự sửa

Hai cột khác nhau:

- **Mức nặng (severity):** hại người dùng bao nhiêu nếu gặp phải.
  - **Critical** — không vào được, mất dữ liệu, hoặc luồng chính không khép (không chốt được quán nên không gọi món).
  - **High** — luồng chính sai kết quả hoặc kẹt, có đường vòng rất khó.
  - **Medium** — làm được nhưng dễ nhầm, lệch giao diện rõ, một nhánh phụ gãy.
  - **Low** — câu chữ, favicon, lệch nhỏ.
- **Thứ tự sửa (priority):** sửa lúc nào. Lỗi High trên màn ít ai mở có thể xếp sau lỗi Medium trên màn cả văn phòng dùng mỗi trưa.

Báo cáo này xếp theo mức nặng. “Top 5 sửa trước” là thứ tự ưu tiên.

## 6. Một báo cáo lỗi đủ dùng

Mỗi lỗi cần đủ để người khác làm lại, không cần ngồi cạnh:

1. **Mã** (`QA-01`) và **màn**.
2. **Loại:** lỗi logic thiết kế / lỗi code / lỗi UX-giao diện / lỗi hiệu năng.
3. **Mức nặng.**
4. **Các bước** đánh số, kèm tài khoản.
5. **Kỳ vọng** — người dùng đáng được thấy gì.
6. **Thực tế** — chuyện gì xảy ra.
7. **Bằng chứng** — ảnh hoặc video, thời điểm.

Logic thiết kế: phần mềm làm đúng chữ trên nút, nhưng **luồng không có kết thúc** hoặc người dùng không biết bước tiếp. Ví dụ: vote quán không có cách chốt và không mở thực đơn quán thắng.

Lỗi code: bấm đúng việc mà kết quả sai, vỡ, hoặc lệch với trạng thái đã lưu (kim vòng quay không trúng ô đang chỉ).
