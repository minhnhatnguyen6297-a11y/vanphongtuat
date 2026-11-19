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
- **Lock.** Minh clicks `getByRole('button', { name: 'Chốt <shop name>' })` for that shop. A badge `CHỐT` is visible on the card. Lan's page, without reload, shows `CHỐT` too.
- **Menu.** The heading `THỰC ĐƠN` lists at least one `button[data-menu]` whose name is a dish of the locked shop, and `.hn-calling-shop` names that shop.
- **Side effect.** Readonly SQL `votes` contains Lan's `shop_id`, and `tables.winner_shop_id` equals the locked shop id from `data-lock`.
- **Dân đen.** On Lan's page, before she is promoted, `button[data-lock]` count is 0. She can vote. She cannot see Chốt.

If `button[data-lock]` count is 0 for Minh (chủ xị), the journey fails. Do not press a hidden control or call `table.setWinner` from the console to force a pass.

## Gotchas

- Dân đen (Lan, Tuấn, Hương, Hoàng, Thảo) are not given `table.setWinner` by the seed matrix. Only Minh, in this seed, is chủ xị. A test that logs in only as Lan and then expects a Chốt button is observing the permission, not a missing seed row.
- Clicking the same `button[data-vote]` again clears the vote (`aria-pressed` returns false). A double click is not a second vote.
- Seed always creates a current table with shops. A journey that requires zero tables fails on this seed; do not delete rows to make an empty-board shot.
- The menu shown before anyone chốt is whatever the screen already labels in `.hn-calling-shop`. Do not treat that label as proof that a vote was closed.
