# Vườn — phong cách để vẽ tiếp

Đọc file này trước khi thêm loài, sửa tranh, hoặc đụng CSS màn `#/vuon`. Hành vi chơi nằm ở [vuon.md](vuon.md).

## Hai ngôn ngữ hình

Phần còn lại của app là neo-brutalism (viền đen, bóng cứng, Bungee). **Không** kéo vườn về kiểu đó, và **không** kéo sảnh về tranh vẽ.

- Ô VƯỜN trên `#/sanh` vẫn là thẻ brutal, có một mảng nền xuân làm ảnh nhỏ.
- Bên trong `#/vuon` là tranh sơn ấm, giờ vàng, vườn gỗ, tử đằng, đèn lồng, hồ, núi, làng xa.

Ảnh chủ đã duyệt (cáo chín đuôi, corgi nắng, mèo có cánh, cây thế giới, tấm Kho) là **bảng mood**: chất sơn, ánh sáng, bố cục nút. Không phải khuôn bắt mọi loài phải có cánh và kim tuyến. Không truy nguyên nhân vật trong ảnh đó thành sprite giao hàng. Cáo chín đuôi khi nào vẽ phải là con cáo của mình, tính cách `du_doi`, không chép tấm mood.

## Bố cục

**Vườn.** Nền full màn. Biển vàng giữa trên: tên theo cấp thật, «Cấp độ: …», số ngày chăm. Viên mùa góc phải: Xuân (hoa), Hạ (mặt trời), Thu (lá phong), Đông (bông tuyết); mùa đang chọn là vòng vàng. Hai viên dưới: **Cho ăn** (cam kem, bát và chân), **Tưới cây** (bạc hà, bình tưới). Dưới nữa là Kho thú cưng, Kho cây trồng, Ghé vườn.

**Khi có thần thoại đang xem hoặc đang đạt:** hình khổng lồ, người mũ rơm và mèo, thỏ ngủ nằm dưới chân. Chỉ lúc đó mới hiện ba hình phụ.

**Kho.** Nút tròn «←». Biển gỗ «Kho thú cưng» hoặc «Kho cây trồng». Biển vàng vẫn trên cảnh. Tấm giấy dưới: một câu ngắn, ba hình Non → Trưởng thành → Thần thoại, mũi tên, nút chăm, chấm trang, mũi tên tròn trái phải. Bấm một cấp là xem tranh.

390px: hai nút chăm nằm cạnh nhau, chữ vẫn đọc được, mùa có thể chỉ còn icon cộng chữ ngắn. `prefers-reduced-motion`: tắt lắc, tắt rơi, tắt nhịp hào quang. Ánh sáng tĩnh vẫn còn.

## Ba cấp, một khuôn mặt

Non và Trưởng thành là đời thường: con non, rồi con lớn khỏe. Chưa phép.

Thần thoại mới bộc lộ tính cách. Cùng loài phải nhận ra là một con (màu lông, dáng tai, loài cây), không đổi thành sinh vật khác trừ khi tên cấp đã hứa (cá koi → rồng koi, sung → cây thế giới).

## Năm tính cách

Gán trong `temper` của `app/src/shared/vuon.ts`. Không hiện cho người chơi như chỉ số.

| Mã | Cảm giác | Được phép | Không làm |
|---|---|---|---|
| `dang_yeu` | Tròn, ấm, muốn tựa vào | Chuông, má, lông dày | Cánh, mưa kim tuyến, mặt dữ |
| `tuoi_sang` | Nắng, vui, sáng | Cánh nhỏ hoặc lửa ấm nếu hợp loài, vài hạt sáng | Mặt nghiêm, bão |
| `tram` | Đứng yên, cũ, trăng hoặc gỗ | Viền bạc, cành già, ít màu | Kim tuyến, cánh, cười toe |
| `du_doi` | Gió, nước, sức | Vảy, bão, đuôi, mắt sắc nhưng không ác | Cánh thiên thần, confetti vàng |
| `the_gioi` | Cây chủ, thác sáng | Ấn trên thân, tia, rễ sáng | Nhân bản sang loài khác |

`the_gioi` hiện chỉ có **sung**. Muốn thêm một cây chủ phải có chủ đồng ý, rồi sửa doc này. Không tự thêm.

Corgi là loài `tuoi_sang` duy nhất trong đợt này được cánh, vì nắng. Đừng copy cánh đó sang mèo, thỏ, sen, mai.

Ánh sáng CSS đi theo tính cách, không một lớp lấp lánh cho tất cả:

- đáng yêu: vầng đào ấm, lắc chậm
- tươi sáng: vầng nắng, vài đốm (chỉ loài này có `.vuon-spark`)
- trầm: viền trăng, gần như không nhúc nhích
- dữ dội: vệt gió ngang, lắc mạnh hơn
- thế giới: tia dọc và lõi vàng

Gió mùa (cánh đào, phấn, lá phong, tuyết) là của nền, không phải của loài.

## Tám loài đã vẽ

| Id | Cấp thường | Thần thoại |
|---|---|---|
| meo | Mèo trắng, chuông | **Đáng yêu.** Ổ lông tròn, không cánh, không kim tuyến. Tên: Mèo bông |
| corgi | Cún vàng ngắn chân | **Tươi sáng.** Corgi vàng, cánh nhỏ, lưỡi, nắng. Tên: Corgi nắng |
| tho | Thỏ trắng | **Trầm.** Thỏ nguyệt, tai dài, mắt tĩnh, ánh bạc, không cười toe |
| koi | Cá koi thật, chưa phải rồng | **Dữ dội.** Rồng koi, nước xoáy, son và chàm, không cánh thiên thần |
| sen | Chồi, rồi một hoa sen | **Tươi sáng.** Sen nở trong nắng sớm, không phải cây có thân |
| mai | Cây mai vàng còn trẻ | **Trầm.** Mai cổ, thân gần đen, hoa kín, không hào quang |
| tre | Măng, rồi khóm đứng | **Dữ dội.** Tre bão, thân nghiêng, lá sắc, không ấn sáng |
| sung | Cây sung thường, chưa có ấn | **Thế giới.** Đa cổ thụ, ấn trên thân, rễ và tia sáng. Tên: Cây thế giới |

Nền Xuân, Hạ, Thu có cây lớn và thác ở xa. Đó là cảnh vườn, không phải sung của người chơi. Đông là sân tuyết, không cây thế giới. Thú và cây của người chơi đứng trên bãi cỏ phía trước.

## Loài chưa có tranh

`art: false`. UI ghi «Chưa có tranh». Tính cách đã chốt, đừng đổi cho dễ vẽ:

| Id | Tính cách | Thần thoại khi vẽ |
|---|---|---|
| cao | du_doi | Cửu vĩ, ruy-băng đỏ, gió. Không chép cáo trong ảnh mood, không gắn cánh corgi |
| chim | tuoi_sang | Phượng lửa, sáng bằng lửa, không phải bản sao cánh corgi |
| rua | tram | Huyền quy, đá, chậm, tĩnh |
| trau | du_doi | Thần ngưu, nặng, đất và bão |
| soc | dang_yeu | Tròn, hạt, ấm |
| hac | tram | Hạc một chân, mực, đứng yên |
| vit | dang_yeu | Mềm, nước nông |
| nai | tuoi_sang | Nai trong nắng rừng, không cánh |
| dao | tuoi_sang | Đào hồng tươi, không thành cây thế giới thứ hai |
| bonsai | tram | Thế già, nhỏ mà nghiêm |
| huong-duong | tuoi_sang | Nắng, mặt hoa, không kim tuyến rắc kín |
| dau-tay | dang_yeu | Quả đỏ, thấp, dễ gần |
| cam-tu-cau | tram | Khối hoa tĩnh, đổi màu, ít sáng |
| tu-dang | tram | Rủ tím, cũ, không biến thành thác sáng |
| anh-dao | tuoi_sang | Hoa sáng, khác mai cổ (mai là trầm, anh đào là tươi) |
| lan | tram | Ít hoa, nghiêm |

Lệch hiện tại: cây `du_doi` mới có tre, cây `dang_yeu` mới có dâu. Loài cây thêm sau nên lấp hai ô đó, không thêm một hoa lấp lánh.

## File

```
app/public/art/vuon/bg/{xuan,ha,thu,dong}.webp
app/public/art/vuon/pet/{id}-{non|truong-thanh|than-thoai}.webp
app/public/art/vuon/plant/{id}-{non|truong-thanh|than-thoai}.webp
app/public/art/vuon/prop/{chibi,meo-ngu,tho-ngu}.webp
```

Nền mỗi mùa dưới khoảng 300 KB. Thú tách nền xanh phẳng, cây tách nền hồng phẳng, rồi WebP. CSS không vẽ con vật.

Bật `art: true` chỉ khi đủ ba file. Thiếu một cấp thì để `false` và khung TODO, đừng lấy tranh thần thoại thu nhỏ giả làm Non.

## Checklist thêm loài

1. Chọn `id` ngắn, không dấu, chưa có trong `VUON_SPECIES`.
2. Chọn `temper` theo bảng trên. Viết một câu vì sao trong `blurb` và trong bảng file này.
3. Non / Trưởng thành là đời thường. Thần thoại mới hiện tính cách.
4. Đặt ba WebP đúng tên. Nhìn cạnh nhau: có nhận ra cùng một loài không, và có khác ba loài cùng tính cách không.
5. `art: true`. Không thêm tiền, shop, nhiệm vụ, hình phạt.
6. Sửa bảng trong file này cho khớp code.

## Những thứ không làm

- Một motif cánh + kim tuyến cho loài mới.
- CSS vẽ mặt, vẽ cây, vẽ thú. CSS chỉ gió và ánh sáng.
- Câu chữ tội lỗi khi chưa chăm.
- Xếp hạng ai chăm nhiều hơn.
- Neo-brutalism bên trong màn vườn.
