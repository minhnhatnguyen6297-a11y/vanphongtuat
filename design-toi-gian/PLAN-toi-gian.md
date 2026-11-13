# PLAN đợt 1: "Hôm Nay Ăn Gì?" chạy máy chủ trong LAN (giao cho worker)

> Ngày: 12/11/2026 · Owner: Minh · Người lập: Claude (phiên thiết kế)
> Căn cứ:
> - `KIEN-TRUC-DE-XUAT.md` (đã review độc lập).
> - Thiết kế 5 màn trong `design-toi-gian/ViaHe-*.dc.html`, bản sống ở https://claude.ai/artifact/GFkiLZaqeZXHzhrfGPy7u8.
> - Thuật toán chia tiền tham chiếu kèm kiểm thử: `design-toi-gian/split.reference.js`.
>
> Plan này **thay toàn bộ** plan cũ (bản 1 file HTML, dữ liệu và key nằm trong trình duyệt).

---

## 0. Đọc trước khi làm

### 0.1 Tinh thần
"Đây là app vui, **không phải app quản lý / kế toán**."
- Không có bước "chốt sổ", không trạng thái Mở/Chốt, không theo dõi nợ.
- Không dòng bill, không gán "cốc này của ai", không ô ship hay giảm giá.
- Không câu chú thích hay hướng dẫn, chỉ có nhãn, số và nút.
- Mỗi màn gọn trong **một màn hình 1366×768** (Sổ ghi được phép cuộn).

### 0.2 Quyết định đã chốt
| Chủ đề | Chốt |
|---|---|
| Thiết bị | **Chỉ máy tính trong LAN**, khoảng 15 máy, dùng Chrome/Edge trên Windows. **Không làm điện thoại** ở đợt này: không kiểm thử 375px, không cần cài chứng chỉ lên điện thoại. |
| Máy chủ | Một máy văn phòng (MAY3: Pentium G6405, RAM 8 GB, Windows 10). Node.js LTS + TypeScript + SQLite + WebSocket qua HTTPS/WSS. |
| Dữ liệu | SQLite trên MAY3 là nguồn dữ liệu duy nhất. Trình duyệt chỉ giữ nháp giao diện. **Không có dữ liệu cũ để nhập**: các bản HTML cũ chưa từng lưu gì vào trình duyệt. Chỉ seed khi tạo cơ sở dữ liệu mới. |
| Đăng nhập | Tên đăng nhập + PIN 6 số. Phiên đăng nhập lưu ở máy chủ, cookie HttpOnly. |
| Vai trò | Ăn uống chỉ có Chủ xị (người kê bàn, lưu `host_id`) và Thành viên. Người vận hành máy chủ có thêm quyền quản lý tài khoản. |
| Chia tiền | Theo tỷ lệ giá order hoặc chia đều, mỗi phần là bội 500đ. **Phần lẻ dưới 500đ do Chủ xị gánh** (xem 6.3). |
| Ảnh | Chỉ giữ trong RAM để gửi AI. Không ghi ra đĩa, log hay bản sao lưu. |
| API key AI | Chỉ nằm trên máy chủ (biến môi trường). Không có ô nhập key trên giao diện. |
| Vòng quay | Máy chủ chọn kết quả. "Chốt quán này" là một thao tác riêng, gắn với đúng lượt quay. |

### 0.3 Còn mở (dùng mặc định, giữ dễ đổi)
1. **Nhà cung cấp AI:** chưa chốt. Viết qua một adapter (mục 8.3). Nếu làm adapter Claude, **load skill `claude-api` trước khi viết**.
2. **Nhãn loại quán:** mặc định `Ăn no / Ăn vặt / Đồ uống`, đặt trong một hằng để đổi một chỗ.

### 0.4 Giữ nguyên từ thiết kế
- **Màu:** cream `#FFF4D6`, đỏ `#C62828`, vàng `#FFCF33`, xanh `#1F5FD1`, lá `#1B7A43`, mực `#1B1B1B`, cam `#F28C28`.
- **Font:** Bungee, Be Vietnam Pro, JetBrains Mono. **Đóng gói font woff2 vào app**, không tải Google Fonts, để LAN mất Internet vẫn chạy.
- **Viền và bóng:** viền mực 3px, bóng cứng 4–6px.
- **Quy tắc giao diện:** không emoji (dùng SVG); vùng bấm ≥ 44px; escape mọi dữ liệu người dùng khi render; AudioContext chỉ resume trong sự kiện click.

### 0.5 Tài liệu cũ
`agents.md`, `specs.md`, `features.md`, `design.md`, `readme.md` vẫn mô tả nợ, dòng bill, ship/voucher, Gmail. **Không sửa khi owner chưa đồng ý**; liệt kê chỗ mâu thuẫn trong báo cáo. `thietke_v1.html` và `thietke_v2.html` chỉ để tham khảo, không sửa.

---

## 1. Cấu trúc dự án

Tạo thư mục mới `D:\vanphongtuat\app\` (git init, nhánh `main`):

```
app/
  package.json            scripts: dev, build, start, test, e2e, admin
  tsconfig.json           strict
  .env.example            HNG_PORT, HNG_DB, HNG_TLS_CERT, HNG_TLS_KEY, HNG_ORIGIN, HNG_AI_PROVIDER, HNG_AI_KEY, HNG_AI_MODEL
  src/shared/             dùng chung cho máy chủ và trình duyệt
    types.ts              kiểu dữ liệu (Member, Shop, Table, Order, Wheel, Spin…)
    commands.ts           schema lệnh WebSocket (zod)
    split.ts              port 1:1 từ design-toi-gian/split.reference.js
    vietqr.ts             payload EMVCo + CRC16
    maps.ts               lấy tên quán từ link /maps/place/
  src/server/
    index.ts              HTTPS + phục vụ file tĩnh + nâng cấp WSS
    db.ts                 mở SQLite, PRAGMA, chạy migrations/*.sql
    migrations/001_init.sql
    seed.ts               chỉ chạy khi cơ sở dữ liệu trống
    auth.ts               PIN (scrypt), phiên đăng nhập, giới hạn thử sai
    http.ts               /api/login, /api/logout, /api/me, /api/ai/:kind
    ws.ts                 hello/snapshot, nhận lệnh, phát cập nhật, heartbeat
    commands/*.ts         xử lý từng nhóm lệnh (table, vote, order, shop, wheel, member)
    perms.ts              ma trận quyền (mục 3)
    ai/queue.ts           hàng đợi 1 tác vụ, timeout, giới hạn dung lượng
    ai/provider.ts        interface + adapter
    backup.ts             sao lưu hằng ngày, giữ 14 bản
    admin-cli.ts          thêm thành viên, đặt lại PIN, khóa tài khoản
  src/client/
    main.ts  store.ts  ws.ts  router.ts
    ui/ header.ts rail.ts modal.ts toast.ts login.ts avatar.ts
    screens/ ban.ts quay.ts tien.ts so.ts kho.ts
    image.ts              chọn ảnh, dán ảnh, chụp màn hình, thu nhỏ ảnh
    copy.ts               clipboard + đường dự phòng
    styles.css            lấy từ design (.hn-shell, .hn-rail, token màu)
  public/index.html  public/fonts/*.woff2
  tools/
    make-ca.ps1           tạo CA nội bộ + chứng chỉ máy chủ (chạy trên MAY3)
    install-root-ca.ps1   cài chứng chỉ gốc trên từng máy trạm (chạy quyền admin)
    install-task.ps1      tạo Task Scheduler tự chạy khi Windows khởi động
    firewall.ps1          mở cổng cho profile Private
  tests/ unit/*.test.ts  server/*.test.ts  e2e/*.spec.ts
  docs/VAN-HANH.md        hướng dẫn cài đặt và vận hành cho owner
```

**Thư viện** (ít, chín muồi):
- Máy chủ: `better-sqlite3` (SQLite đồng bộ, có transaction, có bản dựng sẵn cho Windows x64), `ws`, `zod`.
- Trình duyệt: `qrcode-generator` (đóng gói vào bundle, không dùng CDN).
- Build và kiểm thử: `esbuild` (**một bundle** giao diện), `typescript`, `tsx` khi dev, `@playwright/test`.
- Không dùng framework UI: TypeScript thuần, render bằng template string. Mọi dữ liệu người dùng đi qua `esc()`.

---

## 2. Vận hành trên MAY3 (owner làm, worker viết script và tài liệu)

**Điều kiện trước:**
1. Cập nhật Windows 10 lên **22H2**. Build 19043 hiện tại đã hết hạn bản vá bảo mật.
2. Đặt IP cố định cho MAY3 bằng **DHCP reservation** trên router.
3. Tắt chế độ ngủ khi cắm điện: `powercfg /change standby-timeout-ac 0`.
4. Cài Node.js LTS bản x64.

**HTTPS** (chỉ máy tính nên cài CA nội bộ là khả thi):
- **Tạo chứng chỉ:** `tools/make-ca.ps1` dùng `New-SelfSignedCertificate` (có sẵn trong Windows, không cần thêm công cụ):
  - Tạo **CA gốc** "Hom Nay An Gi Root" hạn 5 năm. Khoá riêng của CA giữ trong `C:\hng-ca\` và chỉ tài khoản vận hành đọc được. **Không đưa vào git.**
  - Tạo **chứng chỉ máy chủ** hạn 1 năm, ký bởi CA, SAN gồm IP cố định và tên `MAY3`.
  - Xuất ra `C:\hng\tls\server.pfx` (hoặc cặp pem).
- **Cài chứng chỉ gốc:** `tools/install-root-ca.ps1` chạy một lần trên mỗi máy trạm bằng quyền admin, dùng `Import-Certificate` vào `Cert:\LocalMachine\Root`. Chrome và Edge trên Windows dùng kho chứng chỉ này. Firefox (nếu có) cần policy `security.enterprise_roots.enabled`.
- **Gia hạn:** `docs/VAN-HANH.md` ghi lịch gia hạn chứng chỉ máy chủ hằng năm.
- **Khi dev:** được dùng mkcert hoặc chứng chỉ tự ký. Tách biệt cấu hình dev với cấu hình vận hành.

**Chạy nền:**
- `tools/install-task.ps1` tạo Task Scheduler: chạy khi Windows khởi động, dưới tài khoản dịch vụ, không chờ đăng nhập, tự chạy lại khi lỗi (3 lần, mỗi lần cách 1 phút).
- Log quay vòng trong `C:\hng\logs\`, **không ghi PIN, cookie, API key, ảnh**.

**Tường lửa:** `tools/firewall.ps1` chỉ mở cổng HTTPS (mặc định 8443) cho profile **Private**. Kiểm tra mạng của các máy trạm là Private, không phải Public hay Guest.

**Sao lưu:**
- Mỗi ngày 12:30 và khi khởi động, chạy `db.backup()` của better-sqlite3 (bản sao nhất quán) vào `D:\hng-backup\hng-YYYYMMDD-HHmm.db`, giữ 14 bản gần nhất.
- `docs/VAN-HANH.md` có quy trình phục hồi. **Worker phải thử phục hồi một lần** và ghi kết quả.

---

## 3. Tài khoản, phiên, quyền

**Thành viên:**
- `members(id TEXT PK uuid, username UNIQUE, display_name, pin_hash, pin_salt, is_operator, bank_bin, bank_account, bank_name_display, disabled, created_at)`.
- PIN 6 số. Băm bằng `crypto.scrypt` (N=2^15, r=8, p=1, salt 16 byte), so sánh bằng `timingSafeEqual`.
- **Giới hạn thử sai:** mỗi username sai 5 lần thì khóa 5 phút, lần khóa sau thời gian gấp đôi, tối đa 1 giờ. Mỗi IP tối đa 30 lần thử mỗi 10 phút.
- **Tạo tài khoản:** `npm run admin -- add <username> "<Tên hiển thị>"` in ra PIN ngẫu nhiên một lần. Có thêm lệnh `reset-pin`, `disable`, `set-operator`.
- Người vận hành cũng làm được các việc này trong modal avatar (mục 4.4).

**Phiên đăng nhập:**
- `auth_sessions(id 32 byte ngẫu nhiên dạng hex, member_id, created_at, last_seen, expires_at, revoked)`.
- Hạn 30 ngày, gia hạn trượt khi có hoạt động.
- Cookie `hng_sid`: `HttpOnly; Secure; SameSite=Strict; Path=/`. Đăng xuất thì thu hồi phiên.

**Chống yêu cầu giả từ trang khác:**
- Mọi POST kiểm tra `Origin` bằng đúng `HNG_ORIGIN` và có header `X-HNG: 1`.
- Khi nâng cấp WebSocket: kiểm tra `Origin` và cookie phiên. Sai thì trả 403.

**Ma trận quyền** (`perms.ts`, máy chủ kiểm tra **mọi** lệnh):
| Lệnh | Ai được làm |
|---|---|
| Kê bàn mới | Mọi thành viên; người kê thành Chủ xị (`host_id`) |
| Thêm quán vào bàn, vote, đổi phiếu | Mọi thành viên; mỗi người 1 phiếu hiệu lực trên 1 bàn |
| Gọi món, sửa và xoá order của mình | Chính người đó |
| Sửa và xoá order của người khác | Chủ xị của bàn |
| Nhập tổng bill, đổi THEO MÓN/CHIA ĐỀU, chốt quán | Chủ xị của bàn |
| Sửa ô vòng quay, quay, tạo vòng mới | Mọi thành viên |
| "Ghi người đi lấy" từ kết quả quay | Mọi thành viên |
| Thêm và sửa quán, menu | Mọi thành viên |
| Quản lý tài khoản | Người vận hành |

---

## 4. Khung giao diện (design: mọi file `ViaHe-*.dc.html`)

### 4.1 Khung lưới
- `.hn-shell` là grid gồm 2 cột `minmax(0,1fr) 62px`, gap `16px 20px`, max-width 1280.
- Hàng 1 là header, chiếm cả 2 cột.
- Hàng 2 là dòng tiêu đề, hàng 3 là nội dung, cả hai nằm ở cột 1.
- Cột 2 là thanh icon `.hn-rail`, `position: sticky; top: 16px`.
- Bỏ media query thanh dưới đáy (không làm điện thoại). Giữ `minmax(0,1fr)` để không tràn ngang ở cửa sổ hẹp.

### 4.2 Header, dòng tiêu đề, thanh icon
- **Header:** dải đỏ có logo "HÔM NAY ĂN GÌ" bên trái, nút avatar tròn 44px bên phải (chữ cái đầu của tên hiển thị).
- **Dòng tiêu đề:** chip mực mono + câu vui Bungee `clamp(30px,4.4vw,52px)`, vàng, viền chữ mực 2px, bóng đỏ 4px, xoay -2°.

| Màn | Chip | Câu vui |
|---|---|---|
| Bàn | `#<số bàn> · dd/mm` | CHỌN ĐI CÁC CHÁU! |
| Quay | `VÒNG QUAY` | QUAY XONG KHÔNG CÃI! |
| Tính tiền | `#<số bàn> · <TÊN NGẮN QUÁN>` | TÍNH TIỀN EM ƠI! |
| Sổ ghi | `THÁNG mm · N BÀN · tổng` | ĂN XONG LÀ XONG! |
| Kho | `N QUÁN` | KHO QUÁN RUỘT! |

- **Thanh icon:** 5 ô 60×60, chỉ có icon SVG (path lấy nguyên từ design), tên màn để ở `aria-label` + `title`.
  - Thứ tự: Bàn, Quay, Tính tiền, Sổ ghi, Kho.
  - Màn đang mở nền vàng kèm `aria-current="page"`; Tính tiền luôn nền đỏ, icon trắng; các ô còn lại nền trắng.
- **Router** theo hash: `#/ban`, `#/quay`, `#/tien`, `#/so`, `#/kho`.

### 4.3 Màn đăng nhập
- Cùng header đỏ. Một khung vàng ở giữa, tiêu đề Bungee "AI ĐÓ?".
- Danh sách nút tên hiển thị để chọn (15 người nên dàn hết ra), ô PIN 6 số (`inputmode=numeric`, `autocomplete=current-password`), nút `VÀO BÀN`.
- Sai PIN: toast "Sai PIN rồi". Bị khóa: toast "Thử lại sau X phút".

### 4.4 Modal avatar
- **Mọi người thấy:** tên hiển thị (sửa được), đổi PIN (nhập PIN cũ + PIN mới), STK nhận tiền (chọn ngân hàng theo BIN, số tài khoản, tên hiển thị trên QR), nút Đăng xuất.
- **Người vận hành thấy thêm:** danh sách thành viên kèm thêm mới (hiện PIN ngẫu nhiên đúng một lần), đặt lại PIN, khóa/mở.
- **Không có** ô API key.

### 4.5 Toast, modal, copy
- **Toast và modal:** giữ phong cách hiện có.
- **Copy:** dùng `navigator.clipboard.writeText`. Bị từ chối thì mở modal có `<textarea>` đã chọn sẵn nội dung và nhãn "Ctrl+C". **Không dùng `execCommand`.**

---

## 5. Dữ liệu và đồng bộ

### 5.1 Schema (`migrations/001_init.sql`, `PRAGMA journal_mode=WAL; foreign_keys=ON`)
```sql
shops(id TEXT PK, name TEXT NOT NULL, phone TEXT, type TEXT CHECK(type IN ('no','vat','uong','')),
      maps_url TEXT, created_by TEXT, created_at, updated_at, version INTEGER)
menu_items(id TEXT PK, shop_id FK, name TEXT, price INTEGER NULL, sort INTEGER)
tables(id INTEGER PRIMARY KEY AUTOINCREMENT,          -- số bàn #12 do DB cấp
       date TEXT, host_id FK members, winner_shop_id NULL, winner_spin_id NULL,
       pickup_member_id NULL, pickup_spin_id NULL,
       bill_total INTEGER NULL, bill_mode TEXT CHECK(bill_mode IN ('item','equal')) DEFAULT 'item',
       created_at, version INTEGER)
table_shops(table_id, shop_id, added_by, PRIMARY KEY(table_id, shop_id))
votes(table_id, member_id, shop_id, updated_at, PRIMARY KEY(table_id, member_id))   -- 1 phiếu/người/bàn
orders(id TEXT PK, table_id, member_id, text TEXT, price INTEGER NULL, created_at, updated_at, version)
wheels(id TEXT PK, title, kind TEXT CHECK(kind IN ('shop','person','free')), table_id NULL, created_by, version)
wheel_items(id TEXT PK, wheel_id, name, weight INTEGER CHECK(weight BETWEEN 1 AND 100),
            ref_shop_id NULL, ref_member_id NULL, votes INTEGER NULL, sort)
spins(id TEXT PK, wheel_id, by_member, items_json TEXT, result_index INTEGER, result_name TEXT,
      started_at INTEGER, duration_ms INTEGER)
ops(op_id TEXT PK, member_id, name, result_json TEXT, created_at)      -- chống gửi trùng
ai_jobs(id TEXT PK, kind, member_id, status TEXT, created_at, finished_at, result_json NULL, error NULL)  -- không có ảnh
```
- **"Bàn hiện tại"** là bàn có `id` lớn nhất. Sổ ghi liệt kê mọi bàn.
- **Thống kê thẻ quán** ("8 lần · lần cuối 05/11"): đếm các bàn có quán hiệu lực là quán đó. Quán hiệu lực = `winner_shop_id`; nếu chưa chốt thì là quán nhiều phiếu nhất; hòa thì lấy quán thêm vào trước.
- **Seed:** 6 quán, 6 thành viên và vài bàn mẫu lấy từ `thietke_v2.html`. Chỉ chạy khi DB trống, mỗi thành viên seed có PIN in ra console một lần.

### 5.2 Giao thức WebSocket (`/ws`, JSON)
- **Mở kết nối:** client gửi `{t:'hello', subs:['table:current','shops','wheels','members']}`. Server trả `{t:'snap', scope, version, data}` cho từng scope.
- **Lệnh:** `{t:'cmd', opId, name, args, baseVersion?}`.
  - `opId` là UUID do client tạo. **Gửi lại cùng `opId` thì nhận đúng kết quả cũ**, nhờ bảng `ops`.
  - Server làm trong **một transaction**: kiểm tra schema (zod), phiên, quyền, `baseVersion` → ghi dữ liệu + ghi `ops` + tăng `version`. Commit xong mới trả `{t:'ack', opId, ok:true, result}` và phát `{t:'snap', scope, version, data}` cho mọi người đang theo dõi scope đó.
  - Dữ liệu một bàn chỉ vài KB nên **phát cả snapshot của scope** là đủ, không cần patch.
- **Xung đột:**
  - Các lệnh sửa (order, quán, ô vòng quay, tên vòng) gửi kèm `baseVersion`. Lệch thì trả `{ok:false, error:'conflict', current}`; client hiện toast "Có người vừa sửa, xem lại nhé" và hiện dữ liệu mới.
  - Lệnh tạo mới và lệnh vote không cần `baseVersion`.
- **Heartbeat:** ping mỗi 20 giây; mất 2 nhịp thì đóng kết nối. Client tự nối lại (thời gian chờ tăng dần, tối đa 10 giây) và gửi lại `hello`.
  - Lệnh chưa nhận ack thì gửi lại với cùng `opId`.
  - Ở đợt 1 **không hiển thị ai đang online**.
- **Danh sách lệnh:**
  - Bàn và vote: `table.create{shopIds}`, `table.addShop{shopId}`, `vote.set{shopId|null}`, `table.setWinner{shopId, spinId?}`, `table.setBill{total|null, mode}`, `table.setPickup{memberId, spinId}`.
  - Order: `order.add{text, price|null}`, `order.update{id, text, price}`, `order.remove{id}`.
  - Quán: `shop.upsert{id?, name, phone, type, mapsUrl}`, `shop.setMenu{shopId, items[]}`.
  - Vòng quay: `wheel.create{title}`, `wheel.rename`, `wheel.item.add/update/remove`, `wheel.equalize`, `wheel.byVote`, `wheel.spin{wheelId}`.
  - Thành viên: `member.updateProfile`, `member.changePin`.
  - Dành cho người vận hành: `admin.*`.
- **Giới hạn đầu vào:** tên và ghi chú ≤ 120 ký tự; giá là số nguyên 0..10.000.000; tối đa 60 món mỗi menu, 30 ô mỗi vòng quay.

---

## 6. Từng màn

Bố cục, màu và kích thước lấy đúng từ design. Dưới đây chỉ ghi hành vi và dữ liệu.

### 6.1 BÀN (`ViaHe-Ban.dc.html`)
- **Lưới:** hàng 1 có vùng VOTE QUÁN (trái) và GỌI MÓN (phải); hàng 2 là khung vàng thực đơn trải ngang (`grid-column: 1/-1`).
- **VOTE QUÁN:**
  - Bên phải tiêu đề là `+ KÊ BÀN MỚI` (mở modal: chip các quán trong kho, chọn nhiều, mặc định chọn sẵn 3 quán gợi ý, nút `KÊ BÀN` gửi lệnh `table.create`) và `LỊCH SỬ BÀN` (chuyển tới `#/so`).
  - **Thẻ quán là `<button>`, bấm để vote hoặc chuyển phiếu.** Thẻ gồm: tên quán, dòng thống kê, các icon ghế cùng số phiếu, thanh %, nhãn `GHẾ CỦA BẠN`.
  - Tem `DẪN ĐẦU` hiện khi bàn chưa chốt; tem `CHỐT` hiện khi đã có `winner_shop_id`.
  - Chủ xị có thêm nút nhỏ `Chốt` trên thẻ, gửi `table.setWinner`.
  - **Gợi ý:** chip nét đứt `+ Tên quán`, lý do để ở `title`. Gợi ý là quán chưa ăn lần nào, quán ≥14 ngày chưa ăn, hoặc quán hay thắng; tối đa 3 quán và không trùng quán đã có trong bàn.
- **GỌI MÓN · <quán đang gọi>:**
  - Quán đang gọi = quán đã chốt; chưa chốt thì là quán dẫn đầu; chưa ai vote thì là quán đầu tiên.
  - **Copy order:** mở modal 2 chế độ. `Cho quán`: gom món giống nhau thành "2 × Sườn". `Kèm tên`: mỗi dòng có tên người.
  - **Phiếu order:** mỗi dòng `tên | món | 45k hoặc ?`, dòng của mình nền cream. Bấm dòng (của mình, hoặc mọi dòng nếu là Chủ xị) để sửa tại chỗ hoặc xoá. Chân phiếu: `N suất` và tổng giá đã biết.
- **Khung thực đơn:**
  - Thẻ món lấy từ `menu_items` của quán đang gọi. Bấm để chọn hoặc bỏ chọn vào nháp (nháp lưu trong `sessionStorage`).
  - Ô `Món khác / ghi chú`, 4 chip ghi chú nhanh (bấm thì nối vào ô), nút `GỌI`.
  - **`GỌI` gửi `order.add`:**
    - `text` = các món đã chọn nối bằng ` + `, thêm `, ghi chú` nếu có.
    - `price` = tổng giá các món đã chọn; có món không giá hoặc chỉ gõ chữ thì `null`.
  - Quán không có menu thì chỉ còn ô ghi chú và chip.

### 6.2 QUAY (`ViaHe-VongQuay.dc.html`)
- **Vùng bàn xoay** (khung xanh): nút loa ở góc trên phải (bật/tắt chỉ áp dụng cho máy đó, lưu `localStorage`), đĩa `min(380px,100%)`, nút quay, ô kết quả `TRỜI ĐÃ ĐỊNH`.
- **Vùng các ô** (khung trắng): chip các vòng cùng `+ VÒNG MỚI`; ô tên vòng; danh sách ô (tên, thanh kéo 1–100, %, ×); `Thêm ô…` + `THÊM`; các nút `Chia đều`, `Theo vote`, `+ gợi ý`; `ĐÃ QUAY` (5 lượt gần nhất **của vòng đang chọn**).
- **Vòng theo bàn:**
  - Lần đầu mở QUAY cho một bàn, máy chủ tạo vòng `kind:'shop'` ("Trưa nay ăn gì?") gồm các quán của bàn, trọng số = số vote × 10 (tối thiểu 5), và vòng `kind:'person'` ("Ai đi lấy đồ?") gồm những người có order.
  - Vòng `free` là vòng chung, không gắn bàn.
- **Quay (`wheel.spin`):**
  - Máy chủ chụp lại danh sách ô và trọng số, chọn kết quả bằng `crypto.randomInt` theo trọng số, rồi lưu `spins` với `started_at` và `duration_ms = 4300`. Sau đó phát cho mọi người.
  - Client nào cũng tự tính góc dừng từ `result_index` + snapshot ô và diễn hoạt **phần thời gian còn lại** dựa trên `started_at`. Người vào muộn thấy luôn kết quả đã lưu.
  - Mỗi vòng chỉ có 1 lượt đang quay: lệnh quay tới trước khi lượt cũ kết thúc thì bị từ chối kèm toast "Đang quay mà".
  - Sửa ô chỉ áp dụng cho lượt sau.
- **Nút quay:** dưới 2 ô thì hiện `THÊM ÍT NHẤT 2 Ô` và disable; đang quay hiện `ĐANG QUAY…`; đã có kết quả hiện `QUAY LẠI`; còn lại `QUAY NGAY`.
- **Ô kết quả:** tên + câu đùa (lần 1: "Không cãi."; lần 2: "Quay lại lần 2. Cả bàn thấy hết."; từ lần 3: "Lần thứ N. Có người chụp màn hình rồi."). Số lần đếm theo các lượt liên tiếp trên vòng đó trong ngày.
  - `shop`: nút `CHỐT QUÁN NÀY`, chỉ Chủ xị thấy, gửi `table.setWinner{shopId, spinId}`. Máy chủ kiểm tra `spinId` thuộc vòng của bàn và kết quả là quán đó.
  - `person`: nút `GHI NGƯỜI ĐI LẤY`, gửi `table.setPickup{memberId, spinId}`.
  - `free`: không có nút.
- **Âm thanh:** tick/ding bằng Web Audio, chỉ phát trên máy người vừa bấm quay và các máy đang mở màn QUAY có loa bật. AudioContext chỉ resume trong sự kiện click (máy chưa từng click thì im lặng). Người dùng bật reduced-motion thì xoay nhanh 0,6 giây.

### 6.3 TÍNH TIỀN (`ViaHe-TinhTien.dc.html`)
- **Khung vàng BILL:**
  - Ảnh bill thu nhỏ, chỉ hiện trong phiên trên máy đó.
  - Nút `CHỤP MÀN HÌNH`, `Dán Ctrl+V`, `Chọn ảnh`.
  - Chip `AI đọc: X đ` khi AI trả kết quả. **AI chỉ điền vào ô, Chủ xị phải bấm lưu** (rời ô hoặc Enter thì gửi `table.setBill`).
  - Ô `TỔNG BILL`: mono 32px; để trống nghĩa là `null`, gõ `0` là 0.
  - Dòng `order X đ` (thêm `(ước)` nếu có giá ước tính); chip đỏ `lệch ±X đ` khi |bill − order| / order > 15%.
  - Công tắc `THEO MÓN | CHIA ĐỀU`.
  - Thành viên không phải Chủ xị thấy ô bill và công tắc ở dạng chỉ xem.
- **Khung MỖI NGƯỜI:**
  - Tiêu đề kèm nút `COPY GỬI NHÓM`.
  - Mỗi người một dòng-nút: tên, số tiền, món, tag `~ giá TB` khi giá được ước tính.
  - Dòng `TỔNG` = bill. **Có phần lẻ thì giữa dòng TỔNG có nhãn đỏ `Chủ xị gánh lẻ +X đ`** (design: bill 340.200đ, mỗi người trả theo 340.000đ, Chủ xị gánh 200đ).
  - Khung QR của người đang chọn: tên · số tiền, ngân hàng · STK của **Chủ xị**, nội dung `#<số bàn> <TÊN KHÔNG DẤU>`.
- **Thuật toán `split()`:** port **nguyên** `design-toi-gian/split.reference.js` sang `src/shared/split.ts`, kèm toàn bộ ca kiểm thử của file đó (unit test). Tóm tắt:
  1. Gom order theo người. Order không giá được tính bằng giá trung bình các order có giá (làm tròn tới đồng) và gắn cờ `estimated`.
  2. `bill = billTotal ?? tổngOrder`; số âm thì về 0; 0 là hợp lệ.
  3. Tổng mục tiêu = `floor(bill / 500) × 500`. **`hostCovers = bill − target` (0–499đ), Chủ xị gánh.** Dùng làm tròn xuống nên phần lẻ luôn ≥ 0, Chủ xị không bao giờ thu thêm của mọi người.
  4. Trọng số: `CHIA ĐỀU` hoặc không ai có giá thì mỗi người 1; còn lại là giá của từng người.
  5. Chia `target / 500` suất theo **phần dư lớn nhất**, tính hoàn toàn bằng số nguyên. Khi hòa phần dư thì Chủ xị nhận suất trước, sau đó theo thứ tự order.
  6. Không có order thì không chia: hiện "Chưa ai gọi món" thay cho danh sách.
  - **Bảo đảm:** tổng các phần + `hostCovers` = bill; mọi phần ≥ 0 và là bội 500. Đã kiểm 2.000 ca ngẫu nhiên.

### 6.4 SỔ GHI (`ViaHe-SoGhi.dc.html`)
- Danh sách mọi bàn, sắp `id` giảm dần, người dùng tự cuộn. Mỗi dòng: `#id` · `dd/mm` · TÊN QUÁN HIỆU LỰC · `N người` · tổng bill (null thì lấy tổng order) · mũi tên.
- **Bấm dòng để mở rộng** (mỗi lúc một dòng): bảng `tên | món | số tiền` tính bằng `split()`, thêm dòng `Chủ xị gánh lẻ` nếu có. Nút `KÊ LẠI BÀN NÀY` gửi `table.create` với cùng danh sách quán rồi chuyển tới `#/ban`.
- **Không có:** lọc, tìm kiếm, nợ, trạng thái.

### 6.5 KHO (`ViaHe-KhoQuan.dc.html`)
- **Khung vàng `+ THÊM QUÁN`** (khi sửa thì đổi thành `SỬA QUÁN`):
  1. **Ô `Dán link Maps / ảnh quán`** + nút `ĐIỀN`.
     - Link thì lấy tên bằng `shared/maps.ts`; **không fetch link**.
     - Dán ảnh vào ô thì gửi AI `shop` để điền tên và SĐT. Thiếu thông tin thì để trống, không báo lỗi.
  2. **Tên** (bắt buộc; trùng tên không phân biệt hoa thường và dấu thì báo toast) và **SĐT** (không bắt buộc).
  3. **Loại:** 3 nút radio, không chọn cũng được.
  4. **MENU:** `Dán ảnh Ctrl+V` / `Chọn ảnh` gửi AI `menu` và nhận lại các chip `tên · giá · ×`. Bấm chip để sửa tại chỗ; ô `+ món` để thêm tay.
  5. **`LƯU VÀO KHO`:** gửi `shop.upsert` rồi `shop.setMenu`. Dữ liệu AI chỉ thành dữ liệu thật khi bấm lưu.
- **Danh sách:** chip lọc theo loại; thẻ một hàng gồm viền trái theo màu loại, tên, chip loại, SĐT, nút `+ Bàn` (`table.addShop` vào bàn hiện tại), nút sửa.

---

## 7. Lấy ảnh (`client/image.ts`)
- **Chọn ảnh:** `<input type=file accept="image/*">` ẩn.
- **Dán ảnh:** bắt sự kiện `paste` trên `document`, lấy `clipboardData.items` có kiểu `image/*`.
  - Ở `#/tien` thì ảnh vào bill.
  - Ở `#/kho` thì ảnh vào ô đang focus (ô Maps/ảnh quán hoặc Menu, mặc định Menu).
- **Chụp màn hình:** dùng `navigator.mediaDevices.getDisplayMedia({video:true})`, chờ có frame đầu, vẽ lên canvas rồi `track.stop()`.
  - Trình duyệt không hỗ trợ thì ẩn nút. Người dùng huỷ thì im lặng.
  - Chỉ chạy được trên HTTPS hợp lệ, nên đây cũng là bài kiểm tra chứng chỉ.
- **Thu nhỏ trước khi gửi:** cạnh dài ≤ 1600px, JPEG chất lượng 0.8, tối đa 2 MB.

## 8. AI trên máy chủ
1. **Gửi ảnh:** `POST /api/ai/:kind` với `kind ∈ {bill, menu, shop}`. Body là ảnh nhị phân, header `Content-Type: image/jpeg|png|webp`, kèm `X-HNG: 1` và kiểm tra Origin.
   - Máy chủ kiểm tra magic bytes, kích thước ≤ 2 MB và phiên đăng nhập.
   - Trả `{jobId}` ngay.
2. **Hàng đợi:** chạy **1 tác vụ cùng lúc**, tối đa 5 tác vụ chờ và tổng 10 MB ảnh trong RAM. Quá giới hạn thì trả 429 kèm toast "AI đang bận, thử lại sau chút".
   - Timeout 30 giây.
   - Gọi API bất đồng bộ để không chặn vote và order.
   - Bảng `ai_jobs` lưu trạng thái và kết quả, **không lưu ảnh**.
   - **Xoá buffer ảnh** khi tác vụ xong, lỗi, timeout hoặc bị huỷ.
3. **Adapter (`ai/provider.ts`):**
   ```ts
   interface AiProvider { read(kind: 'bill'|'menu'|'shop', image: Buffer, mime: string, signal: AbortSignal): Promise<unknown> }
   ```
   - Chọn adapter bằng `HNG_AI_PROVIDER`; key ở `HNG_AI_KEY`, model ở `HNG_AI_MODEL`.
   - Thiếu key thì `/api/ai/*` trả 503 `ai_disabled`. Client vẫn nhận ảnh để xem nhưng hiện toast "AI chưa bật, nhập tay nhé".
   - Làm một adapter thật cho nhà cung cấp owner chọn. Owner chưa chọn thì làm adapter Claude, **load skill `claude-api` trước khi viết**, model đặt qua biến môi trường.
4. **Kết quả trả về** (kiểm tra bằng zod, sai cấu trúc thì coi như lỗi):
   - `bill`: `{ total: number|null }`, là số tiền cuối cùng khách phải trả.
   - `menu`: `{ items: [{ name: string, price: number|null }] }`, giá quy về đồng.
   - `shop`: `{ name: string|null, phone: string|null }`.
5. **Trả kết quả:** máy chủ đẩy `{t:'ai', jobId, ok, result|error}` qua WebSocket cho đúng người gửi.
   - Client điền vào form nháp. **Không ghi đè** dữ liệu người dùng đã sửa tay sau lúc gửi ảnh.
   - Thử lại tạo tác vụ mới, không tạo dữ liệu trùng vì chỉ bấm lưu mới ghi.
6. **Log:** chỉ ghi `jobId, kind, status, thời gian`. Không log ảnh, prompt có ảnh, key.

## 9. VietQR (`shared/vietqr.ts`)
- **Payload EMVCo:**
  - Tag 00 = `01`; tag 01 = `12` (QR động có số tiền).
  - Tag 38: GUID `A000000727`, BIN ngân hàng, STK, dịch vụ `QRIBFTTA`.
  - Tag 53 = `704`; tag 54 = số tiền; tag 58 = `VN`.
  - Tag 62.08 = nội dung CK không dấu, tối đa 25 ký tự.
  - Tag 63 = CRC16-CCITT (0xFFFF).
- **Unit test:** có ít nhất 1 payload mẫu đã kiểm bằng app ngân hàng thật. Owner quét thử và xác nhận.
- Render bằng `qrcode-generator` ra `<canvas>` hoặc SVG.
- Chủ xị chưa nhập STK thì khung QR hiện nút "Thêm STK" mở modal avatar.

---

## 10. Kiểm thử và nghiệm thu
- **Unit** (`node --test` hoặc vitest): `split` (đủ ca trong `split.reference.js` + ca ngẫu nhiên), `vietqr` CRC, `maps`, schema lệnh, `perms`.
- **Máy chủ:**
  - Transaction + idempotency: gửi cùng `opId` 2 lần thì có 1 bản ghi và 2 ack giống nhau.
  - Xung đột `baseVersion`.
  - Giới hạn thử PIN.
  - Kiểm tra Origin và CSRF.
  - Lệnh quay khi đang quay bị từ chối.
  - `table.setWinner` với `spinId` sai bị từ chối.
- **E2E (Playwright, chạy trên máy khác, không chạy trên MAY3)** với 15 tài khoản:
  - 15 người cùng vote: tem DẪN ĐẦU và % đồng bộ đúng trên mọi máy.
  - Gọi món bằng thẻ menu và gõ tay; Chủ xị sửa order người khác; người thường không sửa được.
  - Hai người sửa cùng order thì người sau nhận xung đột.
  - Quay: 15 máy thấy cùng kết quả; máy vào giữa lúc quay thấy kết quả đúng; `CHỐT QUÁN NÀY` đổi tem trên mọi máy.
  - Tính tiền: số khớp `split()`; dòng `Chủ xị gánh lẻ` hiện khi bill lẻ; QR đúng số tiền và STK.
  - Copy order, copy gửi nhóm (clipboard thật trên HTTPS) và đường dự phòng textarea.
  - Mất mạng 30 giây rồi nối lại: lệnh đang chờ được gửi lại, không trùng.
  - Khởi động lại máy chủ: mọi client tự nối lại, dữ liệu còn nguyên.
  - Nhiều tab cùng một tài khoản: vote vẫn là 1 phiếu.
  - AI: ảnh menu và bill thật, ảnh mờ, timeout giả lập, kết quả sai cấu trúc, sửa tay sau AI.
  - Bố cục: mỗi màn (trừ Sổ ghi) có `scrollHeight ≤ 768` ở 1366×768 với seed; không tràn ngang ở cửa sổ 1024px.
- **Hiệu năng** trên MAY3 khi đang chạy công việc văn phòng bình thường:
  - 95% thao tác tới máy khác trong ≤ 500 ms.
  - Bộ nhớ tiến trình ≤ 1 GB khi có hàng đợi AI đầy.
  - Ghi rõ cấu hình máy, số người, kết quả thực đo.
- **Sao lưu:** thử phục hồi một bản sao lưu lên DB trống và ghi kết quả.

## 11. Thứ tự làm (mỗi mốc có demo + test xanh)
1. **M0 · Nền:** repo, build, HTTPS dev, migrations, seed, đăng nhập/đăng xuất, admin CLI, khung giao diện + thanh icon + router, WebSocket hello/snap/cmd/ack.
2. **M1 · Bàn:** kê bàn, thêm quán, vote, chốt, order (thẻ menu, ghi chú, sửa, xoá), copy order.
3. **M2 · Quay:** vòng theo bàn, vòng tự do, quay trên máy chủ, đồng bộ diễn hoạt, chốt quán / ghi người đi lấy.
4. **M3 · Tính tiền:** `split.ts`, bill, công tắc, phần lẻ, QR, copy gửi nhóm, STK trong modal avatar.
5. **M4 · Sổ ghi + Kho:** thống kê, gợi ý, kê lại bàn, thêm/sửa quán, menu tay, link Maps.
6. **M5 · Ảnh + AI:** `image.ts`, `/api/ai`, hàng đợi, adapter, điền nháp.
7. **M6 · Vận hành:** `make-ca.ps1`, `install-root-ca.ps1`, Task Scheduler, firewall, sao lưu/phục hồi, `docs/VAN-HANH.md`.
8. **M7 · E2E + đo hiệu năng** theo mục 10.

**Báo cáo cuối:**
- Đã làm gì, ca nào đã kiểm, ca nào chưa kiểm được (ví dụ AI thật cần key, quét QR cần app ngân hàng).
- Chỗ nào còn dùng mặc định ở mục 0.3.
- Danh sách mâu thuẫn trong tài liệu cũ.

## 12. Ngoài phạm vi đợt 1
- Điện thoại và máy tính bảng.
- Đợt 2: thông báo, chat chung, trạng thái online.
- Đợt 3: sảnh, game theo lượt, người chơi, khán giả.
- Bot Zalo/Slack, webhook ngân hàng, đọc SĐT từ link Maps (Google Places có phí), chạy model AI ngay trên MAY3.
