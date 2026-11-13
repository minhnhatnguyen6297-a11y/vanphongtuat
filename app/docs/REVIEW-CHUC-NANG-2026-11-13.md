# Rà soát chức năng ngày 13/11/2026

Phạm vi: xác thực, phiên đăng nhập, đổi tài khoản, WebSocket/reconnect, quyền, bàn/order/vote, vòng quay, chia tiền, chat, game và sao lưu. Bỏ qua lỗi thẩm mỹ. Đây là báo cáo review; chưa sửa logic ứng dụng hay triển khai bản mới.

## Kết quả và giới hạn

- `npm test`: 59/59 đạt; gồm auth, quyền, chat scope, game, opId/conflict, split, Maps, VietQR.
- `npm run typecheck`: đạt.
- `npm run test:backup-smoke`: đạt phục hồi SQLite.
- `npm run test:concurrent`: 7 đạt trên harness; 1 ca HTTP/WS 15 máy thật bị bỏ qua vì thiếu cấu hình. Số liệu harness không phải hiệu năng LAN thực.
- `npx tsx scripts/review-scenarios.ts`: tái hiện 8 lỗi bên dưới, bằng SQLite trong RAM, WS thật trên cổng ngẫu nhiên, hàm render của client và mô phỏng thứ tự sự kiện WebSocket. Kết quả lưu trong `REVIEW-SCENARIOS-2026-11-13.json`. Không truy cập DB sản xuất trong script.
- Chrome thật: mở tab ứng dụng, phiên Minh được khôi phục; điều hướng bằng bàn phím tới sảnh game. Quan sát phòng `Caro 11:02`, trạng thái đang chơi, Minh là người chơi còn hiển thị, nút CHƠI disabled và XEM khả dụng. Không tạo/xóa phòng thật. Công cụ click bị lỗi `coordinate input geometry is unavailable`, chụp cửa sổ bị timeout; chưa hoàn thành bộ thao tác nhiều tài khoản trên UI thật. Không tuyên bố đã bấm thử toàn bộ màn hình.

## Các lỗi đã tái hiện

### F01 — P1: Rời về sảnh làm mất ghế và không thể quay lại ván

Nguồn: `src/client/screens/sanh.ts:361`, `src/server/commands/game.ts:141`.

Ca thật: A tạo Caro, B vào chơi, bắt đầu ván; B bấm ← SẢNH trong phòng. Nút này gửi `game.leave`, xóa ghế B khỏi `game_members` nhưng giữ B trong state bàn cờ. B thử chơi lại bị `already_started`; nếu vào xem thì không còn quyền đi nước. Đến lượt B ván có thể đứng lại vì không có xử lý bỏ lượt/thua khi rời.

Sửa đề xuất: tách điều hướng khỏi bỏ ván; nút về sảnh không xóa ghế. Bỏ ván phải có quy tắc kết thúc/thua/chuyển lượt rõ ràng và thông báo hệ quả trước khi thực hiện.

### F02 — P1: F5/đăng nhập lại không có nút tiếp tục ván đang chơi

Nguồn: `src/client/screens/sanh.ts:31`, `src/client/screens/sanh.ts:82`, `src/client/ui/login.ts:83`.

Ca thật: người đã có ghế đóng tab/F5 rồi mở sảnh game. `gameRoomId` chỉ ở RAM; đăng nhập luôn đưa về home. Lobby khóa CHƠI cho mọi phòng đang chơi, kể cả chính người đang có ghế. Đây là mất đường quay lại trên UI, không tự chứng minh mất quyền trong DB. Nút XEM hiện có thể giữ nguyên ghế nếu người đó chưa rời vì server trả về ghế cũ; đây là đường vòng không rõ ràng, khác F01 đã mất ghế.

Sửa đề xuất: nút TIẾP TỤC cho thành viên đã có ghế; khôi phục lựa chọn phòng theo tài khoản và xác minh bằng snapshot máy chủ. Kiểm thử cả F5, đóng/mở tab, logout/login cùng tài khoản, A→B→A.

### F03 — P1: Lệnh đang chờ của A được gửi bằng tài khoản B

Nguồn: `src/client/ws.ts:31`, `src/client/ws.ts:207`, `src/client/ws.ts:252`, `src/client/ui/avatar.ts:141`.

Ca: A mất mạng và gửi order; đăng xuất trước ack; B đăng nhập trong cùng tab. `pending` không được xóa hay gắn chủ sở hữu phiên; `resendPending` gửi order của A trên socket B. Server nhận và thực hiện dưới danh tính B.

Sửa đề xuất: ràng buộc pending vào member/session generation; hủy hoặc kết thúc promise khi logout. Không tự replay lệnh qua lần đổi danh tính. Xóa dữ liệu và nháp thuộc tài khoản cũ.

### F04 — P1: Logout ở tab khác không vô hiệu socket đã mở

Nguồn: `src/server/ws.ts:103`, `src/server/ws.ts:163`, `src/server/auth.ts:57`.

Ca: hai tab đăng nhập chung phiên; một tab logout. Phiên DB đã revoked, nhưng socket của tab kia vẫn gọi `member.updateProfile` thành công. `memberFromSession` chỉ chạy khi upgrade; không kiểm tra lại phiên trước lệnh hay fanout.

Sửa đề xuất: lưu sessionId trên client WS; đóng mọi socket của session bị thu hồi, kiểm tra trạng thái phiên khi nhận lệnh và trước gửi dữ liệu. Kiểm thử cả hết hạn cookie, reset/đổi PIN theo chính sách và nhiều tab.

### F05 — P1: Khóa tài khoản nhưng socket cũ vẫn ghi được

Nguồn: `src/server/ws.ts:103`, `src/server/perms.ts:hasPerm/assertCommandAllowed`, `src/server/commands/member.ts:adminDisable`.

Ca: tài khoản đã nối WS bị admin khóa và thu hồi session. Socket giữ object `member.disabled=false` từ lúc kết nối; lệnh cập nhật profile vẫn thành công. Lệnh `self` không tải lại disabled; `hasPerm` cũng không chặn disabled trong DB.

Sửa đề xuất: xác thực lại member/phiên từ DB, chặn disabled ở cổng authorize chung và đóng socket khi khóa. Đồng thời dùng tier hiện hành khi kiểm tra anti-escalation, tránh object tier cũ sau đổi tầng.

### F06 — P2: XEM trước rồi CHƠI vẫn chỉ là khán giả

Nguồn: `src/server/commands/game.ts:118`.

Ca: B vào XEM phòng đang mở; B chọn CHƠI khi còn chỗ. API trả thành công nhưng trả ghế `spectator`, không nâng thành player vì gặp existing thì return luôn. UI khiến người dùng tưởng đã vào chơi.

Sửa đề xuất: xử lý chuyển ghế khi open, kiểm tra quyền và số ghế; tách resume ghế cũ khỏi yêu cầu đổi vai trò.

### F07 — P2: Timer reconnect cũ chạy tiếp sau logout

Nguồn: `src/client/ws.ts:211`.

Ca: mất mạng → lập timer reconnect → logout trước khi timer chạy. Timer không được hủy; gọi `connectWs` sau logout, hàm này lại đặt `intentionalClose=false`. Có thể nối lại trái ý định hoặc lặp reconnect không xác thực; callback socket cũ cũng không kiểm tra socket hiện hành.

Sửa đề xuất: giữ handle timer và connection generation; clear timer khi disconnect; bỏ callback của socket cũ; chỉ reconnect khi còn phiên. Khi nhận 401 phải trở về màn đăng nhập thay vì retry mãi.

### F08 — P1: Cache opId không kiểm tra chủ lệnh, có thể lộ PIN

Nguồn: `src/server/dispatch.ts:31`.

Ca: admin reset PIN với opId X; tài khoản thường gửi lại X. Cache được trả trước authorize và không đối chiếu `ops.member_id`; nhận ack thành công kèm PIN của lệnh reset. Không thực hiện reset lần hai nhưng lộ kết quả đặc quyền. Việc khai thác cần biết opId, không phải đoán được tùy ý; opId UUID ngẫu nhiên giảm khả năng đoán nhưng không thay thế kiểm tra quyền.

Sửa đề xuất: đối chiếu memberId, tên và fingerprint payload khi replay; từ chối opId thuộc người khác; hạn chế lưu plaintext credential trong cache kết quả.

## Phát hiện bổ sung qua code, chưa bấm tái hiện

- `src/client/main.ts:77` thay toàn bộ innerHTML khi snapshot/chat tới; ô chat ở `ui/chat-panel.ts` không lưu nháp qua input event. Một tin chat/snapshot khác có thể xóa nội dung đang gõ và mất focus. Đây là lỗi thao tác, không phải thẩm mỹ.
- Logout chỉ gán `me=null`, không xóa `games`, `chatByScope`, `perms`, lựa chọn phòng và nháp. Trạng thái A có thể hiện tạm thời trong phiên B trước snapshot mới; cần reset store theo phiên.
- `ui/avatar.ts:118` không kiểm tra ack cập nhật profile trước báo đã lưu. `screens/so.ts:110` cũng bỏ qua ack kê lại bàn rồi báo thành công. Cần test khi quyền vừa bị thu hồi hoặc dữ liệu nguồn không còn hợp lệ.
- Mã khởi tạo in PIN ra stdout và Scheduled Task ghi stdout vào log; việc này trái quy tắc log không chứa PIN trong tài liệu vận hành.

## Ma trận kịch bản nghiệm thu tiếp theo

| Kịch bản | Kết quả cần đạt | Trạng thái hiện tại |
|---|---|---|
| Login → F5 | Giữ đúng ID/quyền, lấy lại dữ liệu | auth unit đạt; Chrome khôi phục Minh được |
| Logout/login cùng ID trong ván | Quay về ghế, đi được nước hợp lệ | F02 |
| A → logout → B → logout → A | Không lẫn lệnh, chat, nháp/quyền | F03; store chưa reset |
| Hai tab, logout một tab | Tab kia ngừng gửi lệnh/nhận dữ liệu | F04 |
| Đang mở tab bị khóa/đổi tầng | Quyền hiện hành có hiệu lực ngay | F05; đổi tầng cần test thêm |
| Mất mạng rồi logout trước retry | Không reconnect/replay sau logout | F07 |
| Vào xem → vào chơi phòng open | Có ghế player nếu đủ điều kiện | F06 |
| Đang chơi → về sảnh → trở lại | Ván tiếp tục hoặc bỏ ván có quy tắc | F01 |
| 2 người sửa order cùng version | Một lệnh conflict, không ghi đè âm thầm | test server đạt |
| Gửi lại cùng opId cùng tài khoản | Không nhân đôi order/spin | test server đạt |
| Tài khoản khác dùng opId cũ | Bị từ chối, không lộ kết quả | F08 |
| Nô lệ vote/chat, không quay/chơi | Quyền đúng ma trận | test server đạt |
| Grant còn hạn/hết hạn, anti-escalation | Quyền đúng thời hạn và tầng | test server đạt; UI đang mở cần thử thêm |
| Hai scope chat, rời game | Không nhận nhầm scope | test server đạt; cần thử đa tab |
| Shop/person spin, chốt đúng spinId | Mọi máy cùng kết quả, sai spin bị chặn | test server đạt |
| Theo món/chia đều, tiền lẻ, QR | Tổng đúng, bội 500, host gánh lẻ | unit đạt, gồm 2.000 ca split ngẫu nhiên |
| 15 máy HTTP/WSS thật đồng thời | Đồng bộ và reconnect không mất dữ liệu | Chưa chạy; harness không thay thế |
| Backup → restore | Thành viên/bàn phục hồi | smoke đạt |

Ưu tiên xử lý: F03/F04/F05/F08 (danh tính, phiên và quyền), F01/F02 (tiếp tục ván), rồi F06/F07 và nháp/thông báo thành công. Sau sửa, bổ sung regression test với kỳ vọng hành vi đúng; script review hiện là công cụ ghi nhận lỗi, exit 0 không có nghĩa ứng dụng đã đạt.
