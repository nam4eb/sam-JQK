# Sâm JQK — Nâng cấp link mời dùng chung trong 1 giờ

**Dựa trên `nam4eb/sam-JQK` nhánh `main` (bản đã có sửa đồng bộ hai điện thoại).**

## Thay đổi

- Admin tạo **một link** và gửi cho nhiều người. Link có hiệu lực tối đa **60 phút kể từ khi tạo**.
- Mỗi người dùng một tài khoản Google khác nhau mở link sẽ tự nhận `role: member`, rồi được chuyển đến trang chủ.
- Mỗi lần tham gia ghi **một claim riêng theo UID**: `groups/sam-jqk/invites/{token}/claims/{uid}`. Link gốc **không bị đánh dấu đã dùng** sau người đầu tiên.
- Firestore Rules kiểm tra hạn dùng bằng **`request.time` (giờ server)**; không chỉ kiểm tra `Date.now()` của điện thoại.
- Link v3.1 cũ dùng một lần/7 ngày **không được tái kích hoạt**. Admin phải tạo link mới sau nâng cấp.
- Admin có thể **Thu hồi** link trước hạn, nhưng người **đã tham gia vẫn có quyền** cho đến khi bị Admin thu hồi trong Quản lý truy cập.
- Nếu một người bị thu hồi quyền, họ không thể dùng lại **chính link đã dùng** để tham gia; Admin phải cấp quyền trực tiếp hoặc dùng một link mới (nếu Admin chủ động mời lại).
- Quyền người được mời giữ như trước: nhập ván, tạo ngày, xem báo cáo, chốt `Done`/`Paid`; không có mục Cài đặt hay quyền mời người khác.

## Files cần cập nhật (KHÔNG xóa các file hiện có)

- `src/invites.js`
- `src/InviteAdminPanel.jsx`
- `src/cloud.js` (đã **giữ nguyên** bản sửa `reconcileChange` chống lỗi hai điện thoại)
- `src/invites.test.js`
- `firestore.rules`

Tất cả có sẵn trong ZIP. Các file khác của repo giữ nguyên; **đặc biệt KHÔNG xóa `src/concurrency.js` hoặc `src/concurrency.test.js`.**

## Thứ tự triển khai an toàn

1. Sao lưu JSON từ ứng dụng; trong Firebase Console sao chép Rules hiện tại ra file riêng để có thể rollback.
2. Firebase Console → **Firestore Database → (default) → Rules**: thay toàn bộ bằng file `firestore.rules` trong ZIP, nhấn **Publish**. **Không** dùng `allow read, write: if true`. Rules mới sẽ chặn tạo link bằng bản ứng dụng cũ trong lúc chuyển tiếp.
3. Trong bản clone repo hiện tại, sao chép đè **đúng 5 file** nêu trên hoặc áp dụng file `invite_1h_multi.patch`. Chạy `npm install`, `npm test`, `npm run build`. Push vào `main` (hoặc PR rồi merge).
4. Chờ GitHub Actions `Deploy React to GitHub Pages` thành công; mở https://nam4eb.github.io/sam-JQK/ và tải lại trang trên cả hai máy để nhận JavaScript mới.
5. Admin → **Cài đặt → Link mời thành viên → Tạo link mời 1 giờ**. Gửi **cùng link** tới hai tài khoản Google chưa tham gia. Cả hai đăng nhập và thấy trang chủ, đều mang `role=member`.
6. Xem trong Firestore: `groups/sam-jqk/access/{uidA}` và `.../{uidB}` đều tồn tại; `invites/{token}/claims/{uidA}` và `claims/{uidB}` đều tồn tại; document `invites/{token}` **không có** `claimedBy`.
7. Kiểm tra với tài khoản mới sau giờ hết hạn: phải bị từ chối. Test thu hồi sớm bằng nút **Thu hồi**, người mới mở link bị từ chối. Người đã tham gia vẫn dùng được sổ.

**Lưu ý:** File `firestore.rules` trong repo chỉ là source. **Push source lên GitHub không tự Publish Firestore Rules**, vì workflow hiện tại chỉ deploy GitHub Pages. Bước 2 là bắt buộc.

## Vì sao cần collection claims?

Một link được chia sẻ cho nhiều UID trong 60 phút, nhưng mỗi UID chỉ có thể **nhận lời mời một lần bằng link đó**. React ghi 2 document bằng cùng một Firestore transaction: `access/{uid}` và `invites/{token}/claims/{uid}`. Firestore Rules xác minh 2 document bằng `getAfter()`, kiểm tra `role=member` và thời gian server. Vì không cập nhật document link gốc, nhiều người có thể tham gia cùng lúc mà không tranh chấp `claimedBy`.

## Giới hạn / kiểm chứng

- Đã kiểm tra 19 bài test thuần Node của các file có trong gói; kiểm tra cú pháp JavaScript và JSX, cấu trúc Rules. Chưa chạy Firebase Rules Emulator và chưa kiểm thử với Firebase project thật trong môi trường hiện tại; **nên test 2–3 tài khoản trước khi phát link cho cả nhóm**.
- Khi tạo link, Firebase dùng timestamp server và một timestamp do đồng hồ thiết bị sinh ra. Rules cho phép sai lệch tối đa khoảng 1 phút khi tạo; tuy vậy **thời gian sử dụng được chặn cứng ở server sau 60 phút**. Nếu không tạo được link, hãy đồng bộ ngày/giờ trên điện thoại.
- Link là mã bí mật: ai nhận được link trong 60 phút và đăng nhập Google đều có thể trở thành Member. Không đăng công khai.
- Hết hạn là **vô hiệu hóa quyền dùng link**, không phải xóa ngay document Firestore; không cần bật dịch vụ Cloud Functions hay Firebase TTL.
- Vì toàn bộ cấu trúc vẫn dùng Firestore Spark, không cần server/VPS riêng. Chú ý hạn mức miễn phí của dự án.

## Khôi phục nếu lỗi

Nếu người mới không vào được, kiểm tra Rules đã Publish, source mới có lên GitHub Pages chưa, URL chứa `#invite=...`, Firebase console có bật Google Sign-In. Nếu vẫn lỗi hãy kiểm tra log `permission-denied`; **không mở Rules công khai**. Để rollback, khôi phục source và Rules cũ đồng thời (nhưng link nhiều người của bản mới sẽ không còn hoạt động dưới Rules cũ).
