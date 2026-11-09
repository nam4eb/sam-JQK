# Sâm JQK v3.1 — Link mời thành viên Google

**Repo:** `nam4eb/sam-JQK` · **Trang:** https://nam4eb.github.io/sam-JQK/

## Luồng sử dụng

1. **Admin** mở **Cài đặt → Link mời thành viên → Tạo link mời Member**.
2. Ứng dụng tạo chuỗi ngẫu nhiên 192-bit (48 ký tự hex), lưu tại `groups/sam-jqk/invites/{token}`. Link có dạng `https://nam4eb.github.io/sam-JQK/#invite=...`.
3. Admin nhấn **Sao chép link** và gửi riêng cho một người. Link **dùng một lần**, hết hạn sau **7 ngày**. Có thể thu hồi link chưa dùng.
4. Người bạn mở link trên Safari/Chrome, chọn **Đăng nhập Google**.
5. Sau đăng nhập, React đọc token trong URL và chạy **Firestore transaction** gồm *hai thao tác cùng lúc*: tạo document `access/{uid}` có `role=member` và đánh dấu link đã dùng.
6. Firestore Security Rules kiểm tra token chưa dùng, chưa hết hạn, UID trùng người đăng nhập và cả hai bản ghi được tạo atomically. Nếu thành công, URL chuyển về `#/home` và màn hình chính xuất hiện.
7. Người vào sau bằng cùng link sẽ bị từ chối, cần link mới. Đăng nhập Google không mang link cũng không tự cấp quyền.

## Phân quyền

| Tính năng | Admin | Editor cũ | Member qua link | Viewer cũ |
|---|:---:|:---:|:---:|:---:|
| Xem dữ liệu & báo cáo | ✓ | ✓ | ✓ | ✓ |
| Tạo ngày, chọn người, ghi/sửa ván khi Active | ✓ | ✓ | ✓ | — |
| Chốt Done, đối soát Paid | ✓ | ✓ | ✓ | — |
| Xem tên/QR người chơi | ✓ | ✓ | ✓ | ✓ |
| Thêm/sửa người chơi và ảnh QR | ✓ | ✓ | — | — |
| Thay đổi cài đặt chung & nhập backup | ✓ | — | — | — |
| Mời thành viên, cấp/thu hồi quyền | ✓ | — | — | — |
| Thấy tab Cài đặt | ✓ | ✓ | **Không** | ✓ |

Member có nút **Đăng xuất** trên thanh đầu trang vì tab Cài đặt đã ẩn. Các giới hạn dữ liệu được kiểm tra trong `firestore.rules`, không chỉ dựa vào nút ẩn.

## **Thứ tự triển khai bắt buộc**

**1. Sao lưu:** Admin trên phiên bản đang chạy vào **Cài đặt → Tải bản sao JSON**. Không xóa dữ liệu Firestore hay localStorage.

**2. Publish Firestore Rules MỚI trước:** Firebase Console → Firestore Database → Rules → thay toàn bộ Rules bằng file **`firestore.rules` phiên bản v3.1** trong ZIP → **Publish**. Đây là bước bắt buộc: Rules v3.0 sẽ chặn vai trò `member` và không chấp nhận lời mời.

**3. Deploy React:** Đưa toàn bộ file ZIP, đặc biệt `src/App.jsx`, `src/CloudShell.jsx`, `src/InviteAdminPanel.jsx`, `src/invites.js`, `src/cloud.js`, `src/cloud-model.js`, `src/styles.css`, `firestore.rules` lên nhánh `main` của repo. Không upload ZIP nguyên cục; cần giải nén hoặc push bằng git. Actions tự `npm install → npm run preflight → npm test → npm run build → deploy`.

**4. Kiểm tra:** GitHub Actions màu xanh, trên website tài khoản Admin vẫn đăng nhập và thấy lịch sử. Mở **Cài đặt → Link mời thành viên**.

**5. Thử với tài khoản Google khác:** Admin tạo 1 link → mở trên máy B chưa được cấp quyền → đăng nhập Google → B có `role=member` và vào Tổng quan; kiểm tra không thấy Cài đặt, không thể thêm/sửa thành viên/QR, nhưng tạo ngày và xem Báo cáo được.

**6. Kiểm tra chống dùng lại:** Mở link cũ ở máy C với tài khoản Google khác → phải bị từ chối. Tạo link thứ hai nếu muốn mời máy C.

**7. Kiểm tra thu hồi:** Admin tạo link thử rồi thu hồi trước khi dùng → đăng nhập bằng link đó phải bị từ chối.

## Xử lý lỗi

- **“Không có quyền” sau khi nhập link:** Thường do chưa Publish Rules v3.1, sai Firebase Project hoặc không dùng đúng đường dẫn link.
- **“Link đã được sử dụng hoặc hết hạn”:** Nhờ Admin tạo một link mới; link chỉ dùng cho một UID.
- **Google popup bị chặn:** Mở trực tiếp bằng Chrome/Safari, không mở trong trình duyệt nhúng của Zalo/Messenger.
- **Admin không thấy menu link mời:** GitHub Pages chưa deploy source v3.1 hoặc tài khoản không có `role=admin`.
- **Member đã vào nhóm muốn đăng nhập máy khác:** Chỉ cần đăng nhập **cùng một tài khoản Google**, không cần link thứ hai; quyền gắn với UID chứ không gắn với thiết bị.
- **Admin thu hồi quyền của Member:** Cài đặt → Quản lý truy cập nhóm → Gỡ tài khoản. Link cũ **không** dùng được để lấy lại quyền.

## Mức độ xác minh

- Đã chạy các unit test thuần Node và kiểm tra cú pháp JSX.
- Firestore Security Rules sử dụng `getAfter()` để bảo vệ hai ghi cùng transaction. **Chưa chạy thử bằng Firebase Emulator hoặc Firebase project thật trong môi trường này.** Nên thử bằng 2 tài khoản Google trước khi sử dụng tiền thật. Nếu Firebase Console báo lỗi khi Publish Rules, giữ rules hiện tại và đối chiếu lỗi với nội dung trong ZIP; không thay bằng rules công khai.
- **Không cần Blaze/Cloud Functions**: toàn bộ xác minh link trên Firestore Spark + Security Rules, website chạy GitHub Pages.

## Tài liệu Firebase

- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/auth/web/google-signin
