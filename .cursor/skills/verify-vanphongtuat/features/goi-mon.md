# Gọi món

Sau khi một quán đang được gọi, người bấm một món trên thực đơn rồi bấm GỌI. Dòng món xuất hiện trong danh sách GỌI MÓN, mang tên người gọi. Người kia thấy dòng đó không cần tải lại.

## Sub-features

- `order-pick` toggles a menu chip.
- `order-send` adds a line under GỌI MÓN.
- `order-empty` refuses a send with nothing chosen.
- `order-live` shows the line in the other context.

## How to get to it (user POV)

- Rail `Bàn hôm nay` (`#/ban`). The yellow panel is headed `THỰC ĐƠN`. The send control is the button `GỌI`.

## Driving it with Playwright

Preconditions:

- Minh is on `#/ban`.
- `.hn-calling-shop` has a shop name and at least one `button[data-menu]` is visible. If the menu is empty, fail the journey: this seed's current calling shop has no dishes, and do not invent a dish by SQL.

- **Pick.** Click the first `button[data-menu]`. Its `aria-pressed` becomes `true`. Remember its accessible name.
- **Send.** Click `getByRole('button', { name: 'GỌI' })`. A `.hn-order-row` contains that dish name and `Minh (Bạn)`. Screenshot `01-ordered.png`.
- **Empty.** With no chip pressed and `#ban-note` empty, click GỌI again. A toast `Gõ món hoặc chọn thực đơn` appears and the order count does not grow.
- **Live.** Lan on `#/ban` sees the same dish text without reload.
- **Side effect.** Readonly SQL on `orders` has a row whose `text` contains the dish name and whose `member_id` is Minh.

## Gotchas

- GỌI with an empty selection looks like a dead button unless the toast is watched. The toast lasts about three seconds.
- `#ban-note` placeholder is `Món khác / ghi chú`. A note alone is a valid order. Do not treat an empty-note refusal as failure if a chip is pressed.
- Prices render like `45.000đ`. Assert the dish name the user picked, not a price copied from another run.
- Double-clicking GỌI while a chip stays pressed can add two lines. Count rows before and after one click; do not click twice and expect one line.
