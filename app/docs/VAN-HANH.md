# Vận hành — Hôm Nay Ăn Gì? (MAY3)

Hướng dẫn cài đặt và vận hành máy chủ LAN đợt 1. Chủ sở hữu: owner (Minh). Script nằm trong `app/tools/`.

---

## 1. Điều kiện trước (MAY3)

1. Windows 10 **22H2** (hoặc mới hơn). Build cũ hết hạn vá bảo mật.
2. Đặt **IP cố định** cho MAY3 bằng DHCP reservation trên router. Ghi lại IP (ví dụ `192.168.1.30`).
3. Tắt ngủ khi cắm điện:
   ```powershell
   powercfg /change standby-timeout-ac 0
   ```
4. Cài **Node.js LTS x64**, clone/copy repo vào `D:\vanphongtuat\app`.
5. Trong `app/`:
   ```powershell
   copy .env.example .env
   # Sua HNG_ORIGIN=https://MAY3:8443 (hoac https://<IP>:8443)
   # Sua HNG_DB, HNG_TLS_CERT, HNG_TLS_KEY theo muc 3
   npm install
   npm run build
   npm run seed   # chi khi DB trong
   ```

---

## 2. HTTPS — CA nội bộ + chứng chỉ máy chủ

### 2.1 Tạo CA + cert (một lần trên MAY3, quyền Admin)

```powershell
cd D:\vanphongtuat\app
powershell -ExecutionPolicy Bypass -File .\tools\make-ca.ps1 -ServerIp 192.168.1.30 -DnsName MAY3
```

Kết quả:

| Đường dẫn | Nội dung |
|---|---|
| `C:\hng-ca\hng-root.cer` | CA public — copy sang máy trạm |
| `C:\hng-ca\` | Khoá CA — **chỉ tài khoản vận hành**, không git |
| `C:\hng\tls\server.pfx` | Chứng chỉ máy chủ (1 năm) |
| `C:\hng\tls\pfx.password.txt` | Mật khẩu PFX |

Nếu máy có `openssl`, script cũng xuất `server-cert.pem` / `server-key.pem`.

### 2.2 Cài CA trên mỗi máy trạm (Admin, một lần)

Copy `hng-root.cer` sang máy trạm rồi:

```powershell
powershell -ExecutionPolicy Bypass -File .\install-root-ca.ps1 -CerPath .\hng-root.cer
```

Chrome/Edge dùng `Cert:\LocalMachine\Root`. Firefox: `about:config` → `security.enterprise_roots.enabled = true`.

### 2.3 Cấu hình `.env` trên MAY3

```
HNG_PORT=8443
HNG_ORIGIN=https://MAY3:8443
HNG_DB=C:\hng\data\hng.db
HNG_TLS_CERT=C:\hng\tls\server-cert.pem
HNG_TLS_KEY=C:\hng\tls\server-key.pem
```

**Khi DEV** trên máy lập trình: được dùng mkcert hoặc tự ký (`HNG_DEV_HTTP=1` nếu app hỗ trợ HTTP thuần). Không trộn cert DEV với `C:\hng-ca\`.

### 2.4 Gia hạn chứng chỉ máy chủ (hàng năm)

1. Chạy lại `make-ca.ps1` với cùng `-ServerIp` / `-DnsName` (CA 5 năm được tái dùng nếu còn hạn).
2. Restart task `HNG-Server`.
3. Máy trạm **không** cần cài lại CA trừ khi đổi CA gốc.
4. Ghi lịch: nhắc trước ngày hết hạn ~30 ngày (xem `NotAfter` của cert trong `C:\hng\tls`).

---

## 3. Tường lửa + chạy nền

```powershell
# Admin tren MAY3
powershell -ExecutionPolicy Bypass -File .\tools\firewall.ps1 -Port 8443
powershell -ExecutionPolicy Bypass -File .\tools\install-task.ps1 -AppDir D:\vanphongtuat\app
Start-ScheduledTask -TaskName HNG-Server
```

- Firewall chỉ mở profile **Private**. Kiểm tra máy trạm cũng Private.
- Task chạy AtStartup, SYSTEM, tự chạy lại 3 lần (cách 1 phút).
- Log: `C:\hng\logs\hng-YYYYMMDD.*.log` — **không** ghi PIN, cookie, API key, ảnh.

Kiểm tra nhanh từ máy trạm: mở `https://MAY3:8443` (hoặc IP).

---

## 4. Sao lưu và phục hồi

### 4.1 Sao lưu tự động

App (khi có `src/server/backup.ts`) chạy `db.backup()` của better-sqlite3:

- Mỗi ngày **12:30** và khi **khởi động**
- File: `D:\hng-backup\hng-YYYYMMDD-HHmm.db`
- Giữ **14** bản gần nhất

### 4.2 Phục hồi thủ công

1. Dừng server: `Stop-ScheduledTask -TaskName HNG-Server` (hoặc tắt process Node).
2. Sao chép DB đang chạy ra chỗ an toàn (nếu còn).
3. Copy bản backup chọn lọc thành đường dẫn `HNG_DB`:
   ```powershell
   Stop-ScheduledTask -TaskName HNG-Server
   New-Item -ItemType Directory -Force -Path C:\hng\data | Out-Null
   Copy-Item D:\hng-backup\hng-20261112-1230.db C:\hng\data\hng.db -Force
   Start-ScheduledTask -TaskName HNG-Server
   ```
4. Đăng nhập lại trên trình duyệt, kiểm tra bàn hiện tại / sổ ghi.

### 4.3 Kết quả thử phục hồi (worker OPS)

| Ngày | Cách thử | Kết quả |
|---|---|---|
| 2026-11-12 | `backup.ts` chưa có; `npm run test:backup-smoke` dùng `better-sqlite3.backup()` → restore DB trống → đếm `members=2`, `tables=1` | **PASS** — chi tiết `docs/BACKUP-RESTORE-SMOKE.md` |

---

## 5. Tài khoản vận hành

```powershell
cd D:\vanphongtuat\app
npm run admin -- add minh "Minh"
npm run admin -- set-operator minh
npm run admin -- reset-pin lan
```

PIN in ra **một lần** — lưu chỗ an toàn, không commit.

---

## 6. Sự cố thường gặp

| Triệu chứng | Việc làm |
|---|---|
| Cert cảnh báo trên Chrome | Chưa cài CA / sai máy / Firefox chưa bật enterprise_roots |
| Không vào được từ máy khác | Firewall chưa mở / mạng Public / IP sai / task chưa chạy |
| Task lỗi liên tục | Xem `C:\hng\logs\`; kiểm tra Node path, `.env`, quyền ghi `C:\hng` |
| Mất dữ liệu sau sự cố đĩa | Phục hồi bản mới nhất trong `D:\hng-backup\` |

---

## 7. Checklist hàng năm

- [ ] Gia hạn cert máy chủ (`make-ca.ps1`)
- [ ] Thử phục hồi 1 bản backup lên DB trống
- [ ] Xác nhận Task Scheduler vẫn AtStartup + RestartCount=3
- [ ] Xác nhận firewall Private còn rule `HNG-HTTPS`
