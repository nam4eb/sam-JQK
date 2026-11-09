# Sâm JQK v3.0 — React + Firebase Spark / Firestore

Ứng dụng mobile-first tính tiền bài, đồng bộ giữa ~10 tài khoản Google bằng Cloud Firestore, phục vụ bằng **GitHub Pages**. **Không cần VPS/server tự quản.**

## Chức năng

- Google sign-in, danh sách UID được duyệt, vai trò `Admin`, `Editor`, `Viewer`.
- Thành viên với ID cố định, ảnh QR chuyển khoản (nén trong Firestore).
- Tạo ngày, chọn 2–10 người, mỗi ván 1 người thắng số tiền bằng tổng tiền thua của những người còn lại.
- Tổng tiền thua / thắng / lãi lỗ ròng; báo cáo tháng và CSV.
- Chốt `Done`, khoản chuyển tiền cho từng người thắng; đủ checkbox tự chuyển `Paid`.
- Firestore `onSnapshot` realtime; mỗi lần sửa phiên trong `runTransaction` để tránh ghi đè đồng thời.
- Xuất sao lưu JSON toàn bộ sổ; Admin nhập backup JSON/localStorage cũ khi Firestore trống.
- Tự chốt ngày quá hạn khi có Admin/Editor đang mở website (không có background job).

## Bắt đầu

1. **Đọc `FIREBASE_SETUP.md` từ đầu đến cuối** trước khi upload bản v3 lên website đang hoạt động.
2. Cấu hình project Firebase Spark, Google Authentication, Firestore Security Rules trong `firestore.rules`.
3. Cài bốn **GitHub Actions repository variables** (`FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID`).
4. Upload source lên `nam4eb/sam-JQK`, kiểm tra Actions và mở `https://nam4eb.github.io/sam-JQK/`.
5. Đăng nhập tài khoản quản trị đầu tiên, sao chép UID, tạo thủ công `groups/sam-jqk/access/{UID}` với `role = "admin"`, `active = true` trong Firestore Console.
6. Chuyển JSON/localStorage cũ nếu có, sau đó mời thêm các bạn bằng UID.

## Development

```bash
cp .env.example .env.local
# Điền VITE_FIREBASE_* trong .env.local
npm install
npm test
npm run dev
npm run build
```

Xem `ARCHITECTURE.md` về mô hình dữ liệu, transaction và phân quyền.

**Chưa deploy:** đây là source v3 chuẩn bị cho GitHub Pages. Trước khi Firebase được cấu hình, ứng dụng sẽ hiện màn hình "Cần cấu hình Firebase". Không lưu private key/service account trong GitHub repo. Web config có thể công khai nhưng Firestore Rules phải khóa dữ liệu.

## Chi phí

Gói Spark có quota miễn phí nhưng không vô hạn. Không nâng Blaze nếu muốn không phát sinh tiền. Tránh Cloud Storage/Cloud Functions và không bật billing. Quota và điều kiện mới nhất: https://firebase.google.com/pricing .
