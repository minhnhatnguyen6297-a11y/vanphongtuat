# Vòng quay

Người bấm QUAY NGAY. Đĩa xoay và chậm lại. Khi đĩa đã dừng, dòng TRỜI ĐÃ ĐỊNH nêu một tên, và tên đó là ô đang nằm dưới kim. Trong lúc nút còn là ĐANG QUAY, tên kết quả chưa hiện.

## Sub-features

- `spin-start` disables the button and labels it ĐANG QUAY.
- `spin-hidden` keeps `.hn-wheel-winner` absent while the button says ĐANG QUAY.
- `spin-ease` moves the disc faster at the start than at the end.
- `spin-match` shows a winner equal to the segment under the pointer after the disc stops.
- `spin-again` leaves the button as QUAY LẠI.

## How to get to it (user POV)

- Lobby card `QUẦY VÒNG QUAY`, or rail `Vòng quay` (`#/quay`).
- If no wheel exists, the screen offers `+ VÒNG MỚI`. Seed is not required to contain a wheel. If `#wheel-face` is missing, the journey fails and the reason is recorded here in Gotchas after a run; do not insert a wheel through SQL to manufacture a pass. Creating one with `+ VÒNG MỚI` and two `THÊM` names is the user path.

## Driving it with Playwright

Preconditions:

- Minh is on `#/quay` and can click a button whose name matches `/QUAY NGAY|QUAY LẠI/`.
- `#wheel-face` is visible and at least two `.hn-wheel-label` elements exist.

- **Before.** Screenshot `01-wheel.png`. Record the border colors of `.hn-wheel-disk` and `#wheel-face`.
- **Start.** Click the spin button. The button name becomes `ĐANG QUAY…`.
- **While moving.** About 400ms later, `.hn-wheel-winner` count is 0. Sample `#wheel-face` transform three times, 700ms apart. The first angle delta is greater than the last delta (ease-out). Screenshot `02-wheel-mid.png` during this window.
- **After stop.** Wait until the button name matches `/QUAY LẠI/` and `.hn-wheel-winner` is visible. Screenshot `03-wheel-done.png`.
- **Match.** The winner text equals the `.hn-wheel-label` whose box center is closest to the point at the top-center of `#wheel-face`, just inside the rim, under `.hn-pointer-outer`. Compare those two strings. Do not compare the winner to a server field.
- **Repeat.** Do this five times. Any mismatch or any winner visible during ĐANG QUAY fails the journey.

## Gotchas

- `prefers-reduced-motion` shortens the spin. Turn it off in the Playwright context (`reducedMotion: 'no-preference'`) or the ease sample is too short to judge.
- The pointer is the pair `.hn-pointer-outer` / `.hn-pointer-inner` at the top of the disc, not a CSS `conic-gradient` stop. Sampling `elementFromPoint` on the pointer hits the pointer, not the segment. Sample a point a few pixels below the pointer, inside the face.
- Segment labels use the `title` attribute when the visible text is truncated. Compare `title` when it is set.
- A result card that appears while the button still says ĐANG QUAY is a failure even if the final name is correct.
- Seed may have no wheel. Creating one in the UI is allowed. Inserting `wheels` rows in SQLite is not.
