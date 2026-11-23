# Sâm JQK — Update link mời một giờ, nhiều người

Gói **chỉ các file thay đổi** để cập nhật repo `nam4eb/sam-JQK` đang chạy. Không thay hoặc xóa các file khác.

1. Đọc [UPGRADE_INVITE_1H.md](UPGRADE_INVITE_1H.md).
2. Publish `firestore.rules` trong Firebase Console trước.
3. Chép đè `src/invites.js`, `src/InviteAdminPanel.jsx`, `src/cloud.js`, `src/invites.test.js`; push lên repo.
4. Giữ nguyên `src/concurrency.js` từ bản sửa trước đó.
5. Mở Admin → Cài đặt → Link mời → Tạo link mời 1 giờ.

Có thể dùng `invite_1h_multi.patch` để áp dụng lên bản clone repo.
