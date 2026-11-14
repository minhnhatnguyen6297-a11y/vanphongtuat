# Cờ tỷ phú

Bàn chơi trên trình duyệt, bám luật ván 32 ô của Cờ Tỷ Phú (ZingPlay / 360mobi). Tên ô, quân cờ và hình vẽ là bản vẽ riêng — không dùng logo, nhân vật, âm thanh hay hình của ZingPlay / VNG.

Chơi tại `#/typhu` sau khi đăng nhập. Hai đến bốn người trên một máy, hoặc một người đấu với máy. Ván nằm trong `localStorage` (`hng.co-ty-phu.v1`).

## Nguồn

- [Hệ thống cơ bản — typhu.360play.vn](http://typhu.360play.vn/bai-viet/gioi-thieu/he-thong-co-ban.html): bàn 32 ô, nhóm màu, 5 điểm du lịch, Bắt đầu, Côn Đảo, Đại nhạc hội, Bến xe, Thuế, ô Game, 3 ô Cơ hội, thẻ bài.
- [Quy tắc xây nhà — 2game.vn](https://2game.vn/co-ty-phu-360-huong-dan-quy-tac-xay-nha-post24655.html): năm cấp nhà, vòng đầu chỉ tới chung cư, qua Bắt đầu mới lên khách sạn và biểu tượng, đủ cặp màu thì phí ×2, mua lại giá gấp đôi, đất vàng.
- [Thao tác cơ bản — 2game.vn](https://2game.vn/co-ty-phu-mobile-huong-dan-thao-tac-co-ban-post24638.html): 2–4 người, cách ra đảo, điều kiện thắng (phá sản, 3 cặp màu, một hàng, 5 điểm du lịch, hết 30 lượt).
- [Thế Giới Di Động](https://www.thegioididong.com/game-app/huong-dan-cach-choi-luat-choi-co-ty-phu-tren-zingplay-don-1302846): đổ đôi được đi tiếp, đôi ba lần vào Côn Đảo, lễ hội ×2, thuế 10%.

Thứ tự ô trên bàn thương mại không được công bố thành văn bản. Bàn này xếp nhóm màu tăng giá theo chiều kim đồng hồ, đúng thứ tự nhóm trong bài hệ thống cơ bản.

## Luật đang chơi

Mỗi người có **2.000**. Đi chiều kim đồng hồ. Hai xúc xắc. **Đôi** thì xử lý ô rồi đổ tiếp. **Đôi lần thứ ba** trong cùng lượt thì vào Côn Đảo, không đi tiếp.

**Bắt đầu.** Đi qua hoặc dừng được **300** (15% vốn). Dừng trúng từ lần thứ hai trở đi thì được xây thêm một thành phố đang sở hữu.

**Thành phố.** Người dừng chân mua được ngay, không cần đủ bộ màu. Cùng lúc có thể xây:

| Cấp | Tên |
|---|---|
| 0 | Đất |
| 1 | Nhà |
| 2 | Chung cư — trần của vòng đầu |
| 3 | Khách sạn |
| 4 | Khu nghỉ (biểu tượng) — chỉ sau khi đã qua Bắt đầu, và phải đi qua cấp khách sạn |

**Điểm nghỉ** (5 ô): mua và xây như thành phố, không thuộc bộ màu, không bán lại cho người khác. Gom đủ 5 ô thì thắng.

**Phí ghé** theo cấp nhà. Nhân đôi nếu chủ đã đủ bộ màu, nếu ô đang mở lễ hội, hoặc nếu ô là đất vàng (3 thành phố ngẫu nhiên mỗi ván). Các hệ số cộng dồn.

**Mua lại.** Sau khi trả phí, được mua thành phố của người kia với giá gấp đôi (giá đất + tiền đã xây). Không mua lại ô đã lên khu nghỉ, cũng không mua lại điểm nghỉ.

**Côn Đảo.** Dừng ở ô này, hoặc đôi ba lần, hoặc rút thẻ, thì bị giam tối đa 3 lượt. Ra sớm bằng đổ đôi (đôi đó dùng để ra, không được đổ thêm), nộp 100, hoặc thẻ ra đảo. Hết 3 lần trượt thì nộp 100 rồi đi bằng số vừa đổ.

**Lễ hội.** Nộp 40, chọn một thành phố của mình, phí ghé ô đó ×2 cho đến lễ hội khác.

**Bến xe.** Nộp 40. Lượt sau được chọn bất kỳ ô nào và đi tới (có nhận lương nếu qua Bắt đầu).

**Thuế.** 10% giá trị đất và nhà đang giữ, không tính tiền mặt.

**Đỏ đen.** Cược ít nhất 100 (hoặc cả số còn lại nếu ít hơn). Chọn đỏ hoặc đen. Đúng thì nhận gấp đôi tiền cược.

**Cơ hội.** Ba ô, một cỗ bài trộn: cộng/trừ tiền, thẻ ra đảo, miễn hoặc giảm một lần thuê, phá cấp nhà, mất điện, dịch, buộc bán, đổi thành phố, đến Thuế / Lễ hội / Bến xe / Bắt đầu / Côn Đảo, lễ hội miễn phí, hoặc **du lịch thế giới** (bay tới một điểm nghỉ, không nhận lương dọc đường).

**Thiếu tiền.** Bán từng cấp nhà cho nhà cái lấy nửa tiền xây, hoặc bán đất trống lấy nửa giá. Không đủ thì phá sản: tiền còn lại và đất sang chủ nợ (thuế thì đất trở về bàn). Còn một người thì người đó thắng.

**Thắng**, xét theo thứ tự:

1. Chỉ còn một người chưa phá sản.
2. Sở hữu đủ 5 điểm nghỉ.
3. Sở hữu 3 bộ màu (nhóm đỏ 3 ô vẫn tính một bộ).
4. Sở hữu mọi thành phố trên một cạnh.
5. Hết 30 vòng (mỗi người đã đi 30 lượt): ai nhiều của hơn. Của = tiền mặt + giá đất + tiền đã xây.

Máy đánh theo một luật đơn giản: giữ một khoản dự phòng, ưu tiên mua cho đủ bộ màu, xây khi còn dư, ra đảo nếu nhiều tiền, và bán tài sản rẻ nhất khi thiếu tiền.

## Khác với ZingPlay

- Tên ô là địa danh tự đặt (Cù Lao, Đồi Thông, Bãi Neo…), không phải danh sách tỉnh trên bàn thương mại.
- Không có nhân vật, kỹ năng, xúc xắc đặc biệt, đấu giá, hay mini-game nhiều vòng (bản thương mại nói thưởng đỏ/đen có thể tới ×8). Ở đây đoán một lần, thưởng ×2.
- Bản 32 ô chỉ có Cơ hội, không có ô Khí vận riêng. Thẻ Cơ hội gộp cả vận may và vận rủi. Du lịch thế giới là một thẻ, không phải bàn thế giới thứ hai.
- Không có giới hạn 25 phút. Ván nóng chỉ dừng ở 30 vòng.
- Khi thiếu tiền, người chơi chọn thứ tự bán. Máy thì bán tự động.
- Chơi nóng trên một máy. Không có phòng online trong lần này.

Muốn chơi online sau: `applyCtp` là hàm thuần. Phòng trong `app/src/server/commands/game.ts` (đang chứa Tỉ phú văn phòng) có thể giữ `CtpState`, phát mỗi nước đi, máy khách chỉ animate `last`. Máy đánh chạy ở người giữ phòng để mọi người thấy cùng một kết quả.

## Vì sao bàn trông như thế này

**Đồ họa.** Bàn thương mại là hình vuông 32 ô, nhìn từ trên, khung gỗ, lòng nỉ, dải màu ở mép ngoài, góc to hơn ô giữa, xúc xắc nằm giữa bàn, nút Đổ to dưới tay, tiền và tên người chơi luôn hiện. Bản này giữ đúng cấu trúc đó và tự vẽ: cổng, đảo, sân khấu, xe, nhà, khách sạn, khu nghỉ, bốn quân (thuyền, đèn, diều, trâu). Không copy hình chibi hay logo.

**Web hiện tại.** App là TypeScript thuần, router hash, vẽ lại cả `#app` mỗi lần store đổi (`app/src/client/main.ts`). Luật để ở `app/src/shared/co-ty-phu.ts`, tách khỏi DOM, test bằng `node:test`. Màn `#/typhu` không bị vẽ lại khi WebSocket kêu, để xúc xắc và quân không bị cắt giữa chừng. Sảnh Caro / Cá ngựa / Tỉ phú văn phòng giữ nguyên.

**Máy đang chạy.** 4 nhân Xeon ảo, không GPU, RAM thấy khoảng 16 GB nhưng balloon đang giữ một phần lớn; tiến trình chỉ chiếm dưới 1 GB. Đĩa còn nhiều. Vì không có GPU, bàn là DOM + SVG + CSS (transform), không WebGL, không ảnh nặng. Máy chủ chỉ phát file tĩnh; ván tính trên trình duyệt nên điện thoại không cần sức mạnh đồ họa.

## Cách chơi

1. Vào **Cờ tỷ phú** từ sơ đồ sảnh hoặc từ Sảnh giải trí.
2. Đặt tên, chọn Người hoặc Máy, bốc thăm nếu muốn, bấm **Chơi**.
3. Tới lượt thì bấm **Đổ**. Quân nhảy từng ô. Chọn mua, xây, lễ hội, vé xe, đỏ/đen, hoặc bán khi thiếu tiền.
4. Bấm một ô để xem giá và bảng phí. Tải lại trang thì ván vẫn còn.
