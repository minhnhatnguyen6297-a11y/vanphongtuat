# Đăng nhập

Người chọn tên trên thẻ, gõ PIN 6 số, bấm VÀO SẢNH, và thấy sảnh chào đúng tên. Sai PIN thì còn ở màn đăng nhập.

## Sub-features

- `login-open` shows the roster and the PIN field.
- `login-ok` enters the lobby as the chosen person.
- `login-bad` stays on the login card when the PIN is not 6 correct digits.
- `login-out` returns to the roster.

## How to get to it (user POV)

- Open `http://127.0.0.1:<port>/#/home` with no session.
- From inside the app, choose the avatar button then `Đăng xuất`.

## Driving it with Playwright

Preconditions:

- `doctor.sh` is OK.
- Pins file has `minh`.

- **Open.** `page.goto(origin + '/#/home')`. Heading `ĐĂNG NHẬP` is visible. Screenshot `01-login.png`.
- **Enter.** `getByRole('button', { name: 'Minh (Bạn)' })`, fill `#login-pin` with `pins.minh`, click `getByRole('button', { name: 'VÀO SẢNH' })`.
- **Landed.** Text `CHÀO MINH!` is visible. Screenshot `02-sanh.png`.
- **Side effect.** `GET /api/me` returns `displayName` `Minh (Bạn)`. `auth_sessions` count is higher than before the click.
- **Bad PIN.** A fresh context fills `#login-pin` with `000000` and clicks VÀO SẢNH. The heading `ĐĂNG NHẬP` remains. Toast text includes `Sai PIN`.
- **Logout.** Click `[data-act="avatar"]`, then `#av-logout`. Heading `ĐĂNG NHẬP` returns.

Helper that runs the success path and writes the proof:

```bash
node .cursor/skills/verify-vanphongtuat/scripts/drive-login.mjs
```

## Gotchas

- Opening `http://localhost:<port>` while `HNG_ORIGIN` is `http://127.0.0.1:<port>` makes VÀO SẢNH return csrf. The screen stays on đăng nhập. Use the origin from pins.json.
- The PIN field is `#login-pin` inside the label `PIN 6 số`. Filling a different input does not submit.
- Seed PINs change every empty data dir. Do not hard-code a PIN from an older log.
- Launch's own curl probe already inserts one `auth_sessions` row. The proof is that the browser click increases the count, not that the count is exactly 1.
