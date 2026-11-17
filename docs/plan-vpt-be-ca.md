# Plan coding bể cá — nhánh vpt/fish-tank-features

Nền: `main` `64b7c7e` (đã chứa giao diện `d08d170`). Không merge PR #7 / #8. Nền raster lấy từ commit PR #7 `474626b`, chỉ file `app/public/art/be/`.

1. `app/src/client/be/motion.ts` + test: đi tới đích, nghiêng ±30°, quay 0.4–0.6s co còn 0.4, đuôi lắc, cá xa nhỏ/mờ/ngả xanh.
2. `pad.ts`: bút, tẩy, màu, cỡ nét, hoàn tác, cọ mờ theo vùng, 6 mẫu outline, nhập PNG/JPG/WebP (xem trước rồi đưa vào tranh).
3. `tank.ts`: vẽ nền đã duyệt + gợn, bọt, hạt; thả tranh người chơi. Không cá mẫu bán thật.
4. `screens/chat.ts` + CSS: Phòng chat và khung bể dùng kem/giấy/mực/font local; ô soạn phòng chat là textarea rộng. Không thêm gửi file trong chat.
5. `design.md` lấy bản đầy đủ từ `vpt/design-assets` và chỉ thêm trạng thái code. README và `agents.md` chỉ đổi dẫn chiếu thiết kế.

Rủi ro: vẽ lại cả shell khi có tin nhắn — tranh và nét nằm ngoài DOM nên không mất; con trỏ ô chat vẫn được giữ như cũ. Trả lời thụt chưa có field trên `ChatMsg`.
