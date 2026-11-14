# Vote quán

Trên bàn hôm nay, mỗi người chọn một quán. Phần trăm và tem dẫn đầu đổi cho người khác không cần tải lại. Cuộc vote kết thúc khi có người được quyền bấm Chốt; quán chốt mang tem CHỐT và thực đơn bên dưới là thực đơn của quán đó.

## Sub-features

- `vote-see` shows the shops already on the current table.
- `vote-cast` sets this person's vote and the pressed state.
- `vote-live` shows the other person's new percent without reload.
- `vote-lock` ends the vote on one shop.
- `vote-menu` shows that shop's dishes after the lock.

## How to get to it (user POV)

- From the lobby card `PHÒNG ĂN TRƯA`, or the rail link `Bàn hôm nay`, which sets `#/ban`.
- `+ KÊ BÀN MỚI` starts another table. Seed already has a current table, so the first screen is that table, not an empty one.

## Driving it with Playwright

Preconditions:

- Two contexts, Minh (Bạn) and Lan HR, both past VÀO SẢNH.
- Both open `#/ban`.
- At least one `button[data-vote]` is visible. If none, stop and report failure: seed did not attach shops to the current table.

- **See.** Read each `button[data-vote]` accessible name. Screenshot `01-ban-minh.png`.
- **Cast.** Lan clicks one `button[data-vote]`. That button's `aria-pressed` becomes `true`.
- **Live.** Minh, who did not reload, sees that shop's phiếu text increase. Screenshot `02-ban-minh-after-lan.png`.
- **Lock.** Lan clicks `button[data-lock]` whose accessible name is `Chốt <tên quán>` (nhãn nút: `Chốt quán này`). A badge `CHỐT` is visible. Minh's page, without reload, shows `CHỐT` and the same `.hn-calling-shop`.
- **Menu.** After that click, `button[data-menu]` lists dishes of the locked shop, not the previous calling shop.
- **Side effect.** Readonly SQL `tables.winner_shop_id` equals the `data-lock` id Lan pressed.
- **Countdown.** Kê bàn with `#ct-vote-sec` set to `2`, wait past 2 seconds. `.hn-badge-locked` stays absent and `button[data-lock]` is still visible. The countdown does not close the vote.

If Lan sees zero `button[data-lock]` on an unlocked table, the journey fails. Do not call `table.setWinner` from the console.

## Gotchas

- Dân đen và nô lệ đều có nút `Chốt quán này`. Chỉ chủ xị mới thấy nút là journey sai.
- Ô đếm ngược lúc kê bàn không tự khóa và không bắt buộc hiện đồng hồ. Hết số giây mà vẫn còn nút Chốt là đúng spec.
- Clicking the same `button[data-vote]` again clears the vote (`aria-pressed` returns false). A double click is not a second vote.
- Seed always creates a current table with shops. A journey that requires zero tables fails on this seed; do not delete rows to make an empty-board shot.
- The menu shown before anyone chốt is whatever the screen already labels in `.hn-calling-shop`. Do not treat that label as proof that a vote was closed.
