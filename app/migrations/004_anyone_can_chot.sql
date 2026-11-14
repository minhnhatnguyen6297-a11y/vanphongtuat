-- Chốt quán là việc của mọi người đang tham gia, không chỉ chủ xị.
-- DB mới nhận quyền này từ ma trận mặc định lúc seed.
-- DB đã seed thì bật quyền cho dân đen và nô lệ. Không tự khóa vote.
UPDATE role_permissions
SET allowed = 1
WHERE perm_key = 'table.setWinner'
  AND tier IN ('dan_den', 'no_le');
