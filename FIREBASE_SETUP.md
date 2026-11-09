# Triển khai Sâm JQK v3.0 — Firebase Spark + GitHub Pages

> **Mục tiêu:** một sổ chung cho khoảng 10 tài khoản Google, đồng bộ gần thời gian thực, không cần VPS/server tự quản, giữ website GitHub Pages `https://nam4eb.github.io/sam-JQK/`.
>
> **Trạng thái:** source code đã chuẩn bị; chưa kết nối Firebase thật và chưa deploy bản v3. Bản trước trên GitHub không bị ảnh hưởng khi chưa push.

## 0. Giữ dữ liệu cũ trước khi làm

Trên **đúng điện thoại/trình duyệt đang có lịch sử**, mở Sâm JQK v2.1 → Cài đặt → **Tải bản sao JSON**. Giữ file ở nơi an toàn. **Không xóa dữ liệu trang web, không gỡ ứng dụng, không xóa localStorage.** v3 giữ nguyên khóa dữ liệu cũ `so-van/mobile-ledger/v1` để hỗ trợ chuyển đổi.

## 1. Tạo dự án miễn phí

1. Mở https://console.firebase.google.com/ → **Add project / Create project**.
2. Đặt tên, ví dụ **sam-jqk**, tắt Google Analytics nếu không dùng.
3. Trong **Usage and billing**, kiểm tra gói **Spark (no-cost)**; **không** thêm phương thức thanh toán và không nâng lên Blaze.
4. **Build → Firestore Database → Create database**, chọn **Standard edition** và khu vực gần nhóm. Chọn **Production mode** hoặc chọn chế độ đóng và **phải thay Security Rules** ở bước 3. Tạo database `(default)`.
5. **Build → Authentication → Get started → Sign-in method → Google → Enable**, chọn email hỗ trợ và Save.
6. **Authentication → Settings → Authorized domains → Add domain**: nhập chính xác `nam4eb.github.io` (không thêm `https://` hoặc `/sam-JQK/`). Để phát triển localhost, thêm `localhost` nếu chưa có.

Google login tạo Firebase UID riêng cho mỗi tài khoản; **đăng nhập thành công KHÔNG có nghĩa được cấp quyền đọc dữ liệu**.

## 2. Lấy cấu hình Web SDK

Trong **Project settings (biểu tượng bánh răng) → General → Your apps → Web `</>`** tạo web app. Lấy các trường của `firebaseConfig`:

| Firebase Web App config | GitHub Actions repository variable |
| --- | --- |
| `apiKey` | `FIREBASE_API_KEY` |
| `authDomain` | `FIREBASE_AUTH_DOMAIN` |
| `projectId` | `FIREBASE_PROJECT_ID` |
| `appId` | `FIREBASE_APP_ID` |

Vào `https://github.com/nam4eb/sam-JQK/settings/variables/actions` → **New repository variable** cho đủ 4 tên trên. Workflow `.github/workflows/deploy.yml` tự đưa những biến này vào Vite build dưới dạng `VITE_FIREBASE_*`.

**Lưu ý:** Firebase Web App `apiKey` là thông tin cấu hình client công khai, **không phải khóa quản trị**. Security Rules mới bảo vệ dữ liệu. Tuyệt đối không đặt Firebase service-account JSON, private key hay token GitHub trong source hoặc chat.

Để chạy local: copy `.env.example` thành `.env.local`, điền 4 giá trị (biến có prefix `VITE_`), rồi chạy `npm install`, `npm test`, `npm run dev`. `.env.local` đã được gitignore.

## 3. Cài Firestore Security Rules — BẮT BUỘC

1. Firebase Console → **Firestore Database → Rules**.
2. Dán **toàn bộ** nội dung file `firestore.rules` từ source v3.
3. Chọn **Publish**. Không dùng `allow read, write: if true` và không chỉ dùng `request.auth != null`.
4. Nếu có lỗi cú pháp, sửa theo thông báo trong Console trước khi triển khai; không mở rules rộng để bỏ qua lỗi.

Rules giới hạn truy cập ở `groups/sam-jqk` và kiểm tra tài khoản trong `access/{uid}`. Chỉ Admin được cấp/thu hồi quyền; Editor có thể thêm thành viên, sửa ván, chốt và xác nhận chuyển khoản; Viewer chỉ xem. Các phiên Done/Paid không cho sửa ván/tiền qua ứng dụng, chỉ cho cập nhật thanh toán.

## 4. Đưa source v3 lên GitHub Pages

1. Giải nén gói `SamJQK_Firebase_React_v3.zip`.
2. Trong repo `https://github.com/nam4eb/sam-JQK` thay các file mã nguồn, giữ cấu trúc gồm `src/`, `public/`, `.github/workflows/deploy.yml`, `package.json`, `vite.config.js`, `firestore.rules`.
3. Commit vào branch `main` qua GitHub Desktop hoặc tạo PR rồi merge vào `main`.
4. Repo **Settings → Pages → Source = GitHub Actions**.
5. Tab **Actions** kiểm tra workflow: **Test business logic → Build → Deploy** có trạng thái success.
6. Mở `https://nam4eb.github.io/sam-JQK/`. Nếu hiện "Cần cấu hình Firebase", kiểm tra biến ở bước 2 rồi **Run workflow** mới (Vite đọc biến tại thời điểm build).

**Quan trọng:** Hãy thực hiện bước 1–3 trước khi phát hành v3; bản v3 chưa cấu hình sẽ hiện màn hình thiết lập thay vì giao diện chơi như v2.

## 5. Kích hoạt quyền Admin đầu tiên

1. Mở URL v3 trên điện thoại → **Đăng nhập bằng Google** bằng tài khoản chính.
2. Vì chưa được cấp quyền, trang sẽ hiện **Tài khoản chưa được duyệt** cùng Firebase **UID**. Nhấn Sao chép UID.
3. Vào **Firebase Console → Firestore Database → Data** (trong tài khoản quản trị Firebase), tạo cây:

```text
groups                         [collection]
  sam-jqk                      [document, có thể thêm name = "Sâm JQK"]
    access                     [subcollection]
      DÁN_UID_CỦA_BẠN          [document ID = UID]
        uid      = "DÁN_UID_CỦA_BẠN"    (string)
        email    = "email-google-cua-ban@gmail.com" (string)
        role     = "admin"             (string)
        active   = true                (boolean)
```

4. Mở lại website hoặc đợi realtime listener cập nhật. Ứng dụng sẽ được vào màn quản lý và tự tạo `groups/sam-jqk/meta/main` với `mode = ready`.

Nếu admin không vào được, kiểm tra UID có đúng **document ID** và field `uid` hay không, `active` là boolean (không phải chuỗi `"true"`) và đã Publish rules.

## 6. Mời 9 người còn lại

1. Mỗi người mở URL, nhấn **Đăng nhập Google**. Chưa có quyền sẽ thấy UID của mình.
2. Gửi UID đó cho Admin bằng kênh tin nhắn riêng.
3. Admin mở **Cài đặt → Quản lý truy cập nhóm → Mời thành viên**, nhập UID, email hiển thị, chọn **Viewer** hoặc **Editor** rồi cấp quyền.
4. Người bạn sẽ tự vào được sau khi quyền cập nhật. Admin có thể đổi vai trò hoặc thu hồi trong Cài đặt.

**Gợi ý vai trò:** 1–2 Admin; 1–3 Editor phụ trách ghi ván/chốt/đối soát; những người còn lại Viewer để tránh sửa nhầm. Nếu muốn cả 10 người tích Paid, cấp Editor cho 10 người; mọi Editor đều có thể sửa dữ liệu ván Active của nhóm.

## 7. Chuyển dữ liệu localStorage / backup JSON lên Firestore

**Chỉ thực hiện sau khi đã có Admin và khi danh sách thành viên + phiên trên Firestore còn trống. Nên làm trước khi mời những người khác vào chơi.**

Cách A — trên **đúng điện thoại** còn dữ liệu v2.1:

1. Đăng nhập bằng tài khoản Admin vào v3 tại cùng URL và cùng trình duyệt.
2. Cài đặt → **Nhập dữ liệu localStorage cũ (N phiên)** → đọc xác nhận → Đồng ý.
3. Đợi chỉ báo số mục đã ghi xong. Không đóng tab khi đang nhập.

Cách B — từ bất kỳ thiết bị nào có file JSON đã sao lưu:

1. Cài đặt → **Nhập JSON cũ vào Firestore** → chọn file backup v2.1.
2. Xác nhận, đợi thông báo hoàn tất.

Bộ nhập sẽ **kiểm tra cấu trúc**, giữ ID ổn định, giữ QR và lịch sử, tạo mỗi thành viên/phiên thành một Firestore document. Trạng thái được chuẩn hóa từ checkbox: tất cả khoản trả → `Paid`, thiếu khoản → `Done`. Không tự xóa dữ liệu gốc trên thiết bị. Nếu nhập bị ngắt giữa chừng, Firebase đánh dấu `meta/main.mode = migrating` và có thể dùng **cùng tài khoản Admin, cùng file JSON** chạy lại để hoàn tất; không nhập file khác giữa chừng.

**Không nhập khi Firestore đã có thành viên/phiên mới.** Không có cơ chế tự động merge 2 sổ khác nhau. Hãy xuất cloud JSON và xử lý đối chiếu riêng trước khi hợp nhất để tránh ghi đè lịch sử.

## 8. Kiểm thử trên hai điện thoại

1. A (Editor): tạo 1 ngày với 3 người, nhập 1 ván; B (Viewer) thấy ván mới mà không tải lại trang.
2. B không thấy nút sửa; thử làm sai quyền phải bị Firestore từ chối.
3. A chốt Done; một Editor tích từng khoản Paid; mọi thiết bị thấy thay đổi. Bỏ tích một khoản phải quay lại Done.
4. A cập nhật QR trong Thành viên; B mở ngày chốt và xem QR người nhận.
5. Kiểm thử 2 Editor sửa cùng một phiên: một thao tác có thể báo "có dữ liệu mới"; mở lại phiên và thử lại, **không được âm thầm ghi đè**.
6. Admin thu hồi UID của một máy thử nghiệm, máy đó không còn xem sổ nữa.
7. Admin xuất JSON cloud độc lập để sao lưu.

## 9. Cảnh báo chi phí và hạn chế

- Gói Spark cho phép bắt đầu không cần thẻ. Quota Firestore Standard trong trang giá hiện hành: **1 GiB dữ liệu, 50.000 reads/ngày, 20.000 writes/ngày** (thay đổi theo Firebase). Giữ Spark để không bị tính phí phát sinh; khi hết quota thao tác có thể bị chặn. Xem https://firebase.google.com/pricing.
- QR tải lên được **nén và lưu dạng base64 trong Firestore document thành viên** để tránh cần Cloud Storage. Chỉ dùng ảnh QR, **không** lưu ảnh chụp CCCD hay thông tin ngân hàng nhạy cảm ngoài mã QR.
- Trình duyệt vẫn cần mạng để lưu transaction; bản này không quảng cáo chỉnh sửa offline/sync sau đó.
- Tự chốt 7 ngày chỉ chạy khi **một thiết bị Editor/Admin đang mở web**, không có tác vụ server chạy nền.
- Các quy tắc bảo vệ quyền truy cập và khóa ván đã chốt. Nhưng không có server tin cậy để xác minh phép tính nếu một **Editor cố ý** gửi dữ liệu gian lận từ client; đây là ứng dụng dành cho nhóm bạn tin cậy, không phải hệ thống tài chính chống gian lận tuyệt đối.
- Một ngày tối đa 200 ván và 10 người, phù hợp document Firestore. Nếu tương lai hàng chục nghìn phiên/QR lớn, cần tối ưu phân trang, quyền riêng cho xác nhận thanh toán và sao lưu có quản lý.

## 10. Tài liệu chính thức

- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/firestore/query-data/listen
- https://firebase.google.com/docs/firestore/manage-data/transactions
- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/pricing
