# Verification map — Hôm Nay Ăn Gì?

Drive only an instance started by `../scripts/launch.sh`. Do not point these recipes at port 8443.

## Baseline preconditions

- `../scripts/doctor.sh` prints `DOCTOR OK`.
- Origin is `http://127.0.0.1:<port>` from `/tmp/vanphongtuat-verify-run/pins.json`.
- Seed members exist: Minh (Bạn) is chủ xị; Lan HR, Tuấn Dev, Hương Kế Toán, Hoàng Design, Thảo Marketing are dân đen. PINs are in that pins file.
- Seed also inserts shops and a current lunch table. Journeys that need a world with zero tables are not satisfied by this seed.

## Driving conventions

- Playwright, system Chrome, no coordinate clicks.
- Prefer role, accessible name, and `data-*` handles listed in `../SKILL.md`.
- Two users means two browser contexts, not two clicks in one page.
- Proof screenshots and `result.json` go under `/tmp/vanphongtuat-verify-evidence/<feature>/`.
- Read the database only after the click, to show the row the click created.

## Features

- [Đăng nhập](./dang-nhap.md)
- [Vote quán](./vote-quan.md)
- [Gọi món](./goi-mon.md)
- [Vòng quay](./vong-quay.md)
- [Tính tiền](./tinh-tien.md)
