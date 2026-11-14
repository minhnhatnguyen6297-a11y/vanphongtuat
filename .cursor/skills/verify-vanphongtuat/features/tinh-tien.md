# Tính tiền

Người nhập tổng bill, chọn THEO MÓN hoặc CHIA ĐỀU, và đọc số mỗi người. Số chia là bội của 500 đồng. Phần lẻ 0–499 đồng do chủ xị gánh, không chia tiếp. VietQR chỉ hiện khi chủ xị đã có số tài khoản.

## Sub-features

- `bill-enter` saves a total typed into the bill field.
- `bill-equal` shows equal shares of the 500-rounded total.
- `bill-item` shows shares that follow each person's dishes.
- `bill-qr-missing` shows Thêm STK when the host has no account.
- `bill-ai` does not invent a total when no API key is configured.

## How to get to it (user POV)

- Lobby card `KÉT TIỀN`, or rail `Tính tiền` (`#/tien`).
- The total field is `#bill-total`. The mode switch is the group `aria-label="Cách chia"`.

## Driving it with Playwright

Preconditions:

- Minh is on `#/tien`.
- The current table has at least two order rows with prices, visible as person lines. If fewer than two priced people are visible, fail: this seed's current table does not have two priced orders, and do not insert orders in SQL.

- **Count.** Let `n` be the number of `.hn-person-row` lines. Choose a bill of `n * 10000` (divisible by 500 and by `n`).
- **Equal.** Click the button named `CHIA ĐỀU` in the group `Cách chia`. Fill `#bill-total` with that bill and press Enter.
- **Observe.** Each person line shows the same money text, `10.000đ`. No line shows a remainder that is not a multiple of 500. Screenshot `01-equal.png`.
- **Item.** Click `THEO MÓN`. The lines may differ. Each visible share is still a multiple of 500. The sum of the shares plus any `Chủ xị gánh lẻ` amount equals the bill that was typed.
- **QR.** With seed Minh, no bank account was entered. A button `Thêm STK` is visible and `[aria-label="Mã VietQR"]` is absent. Screenshot `02-no-qr.png`.
- **AI.** Click `AI · Dán ảnh bill` with an empty clipboard. The user stays on the bill screen; the total does not change by itself.
- **Side effect.** Readonly SQL `tables.bill_total` equals the number typed, and `bill_mode` is `equal` or `item` matching the last click.

Expected shares come from the rule "bội 500, phần lẻ chủ xị gánh, CHIA ĐỀU means equal parts", not from printing whatever the page showed on a previous run.

## Gotchas

- `#bill-total` saves on change and on Enter, not on every keystroke. A screenshot taken before Enter still shows the old total.
- Dân đen do not see an editable total. Drive this journey as Minh.
- VietQR needs a bank chosen in the avatar dialog. Seed has no account. Do not write `bank_account` in SQL and call the QR proven.
- The AI buttons are visible with no key. Absence of a parsed total is the expected observation, not a skipped test.
