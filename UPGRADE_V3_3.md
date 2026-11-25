# Sâm JQK v3.3 — Thay người giữa buổi + Báo sâm / Cháy / Bắt 2

Dự án: https://github.com/nam4eb/sam-JQK · Web: https://nam4eb.github.io/sam-JQK/

## Trước khi nâng cấp

1. Trên tài khoản Admin, xuất **backup JSON cloud** và tải về thiết bị an toàn.
2. Trong Firebase Console → Firestore → Rules, **sao lưu Rules đang chạy** ra file riêng.
3. **Đừng xóa Firestore hay import lại bản backup cũ**, vì source mới đọc trực tiếp dữ liệu hiện hữu.
4. Ba phiên Done/Paid được tạo trước đây **vẫn là ba phiên riêng**. Không tự gộp để tránh làm sai xác nhận thanh toán. Từ đây về sau dùng **một phiên Active** trong cả buổi.

## Triển khai

1. Firebase Console → Firestore Database `(default)` → **Rules** → dán toàn bộ nội dung `firestore.rules` trong gói v3.3 → **Publish**. Rule v3.3 tiếp tục bảo vệ Admin / Editor / Member / Viewer và link mời nhiều người trong 1 giờ; mở rộng schema của phiên chơi cho `activeMemberIds`.
2. Đẩy source v3.3 vào `main`, hoặc chỉ thay đúng các file:
   - `src/App.jsx`
   - `src/ledger.js`
   - `src/cloud-model.js`
   - `src/concurrency.js`
   - `src/styles.css`
   - `src/concurrency.test.js`, `src/game-v3_3.test.js` (tests)
   - `scripts/preflight.mjs`
   - `firestore.rules`
   - `package.json` (chỉ thay version, không bắt buộc)
3. **Giữ nguyên** `src/cloud.js`, `src/CloudShell.jsx`, `src/invites.js`, `src/InviteAdminPanel.jsx` đang chạy v3.2. Cơ chế mời nhiều người/1 giờ không thay đổi.
4. Kiểm tra GitHub Actions **Preflight → Test → Build → Deploy** đều xanh. Tải lại website ở cả hai điện thoại (có thể cần xóa cache trình duyệt, **không xóa localStorage** khi chưa backup).

## Cách dùng chức năng đổi người

1. Tạo **một ngày chơi Active** bình thường và nhập các ván đầu.
2. Khi có người đến muộn/về sớm: mở phiên Active → **Thêm / tạm nghỉ người chơi** hoặc **Thay đổi** trong khối người đang chơi.
3. **Bỏ tích** người đã về; **tích** người mới đến; bấm **Áp dụng cho ván tiếp**.
4. Người tạm nghỉ **không** mất lịch sử; tổng kết cuối phiên vẫn gồm họ. Mỗi ván mới dùng đúng danh sách đang chơi lúc thêm ván.
5. Người đã tạm nghỉ có thể được bật lại. Mỗi ván 2–10 người; cả buổi có thể có tối đa 100 người đã tham gia. Nếu người mới **chưa có trong danh sách Thành viên toàn nhóm**, Admin/Editor cần thêm người đó vào danh sách trước.
6. Khi đã `Done` hoặc `Paid`, phiên vẫn **bị khóa** và không cho đổi người hoặc sửa ván.

### Báo sâm thắng

Trong **Nhập ván mới**, chọn người báo sâm thắng rồi bật **Báo sâm thắng**. App tự động tính mỗi người còn lại đang chơi **−20** (nghìn đồng) và người báo sâm **+(số đối thủ × 20)**, không cần nhập từng ô. Ví dụ 5 người: +80, bốn người còn lại −20 mỗi người.

### Cháy +15

Ở ván thường, cạnh tên mỗi người thua có nút **Cháy +15**. Nhấn một lần để **cộng thêm 15** vào ô tiền thua của người đó. Nút chuyển trạng thái đã bật; nhấn lại để **trừ 15**. Nếu ô trước đó là 3, sau khi bấm sẽ là 18. Không dùng nút Cháy trên ván Báo sâm để tránh tính hai lần.

### Bắt 2 +20 / −20

Trong cùng form, chọn **Thêm cặp Bắt 2** → chọn **Người bị bắt 2** và **Người bắt 2**. App ghi một khoản riêng: **người bị bắt −20**, **người bắt +20**; phần thắng ván thường **không nhận thêm 20** trừ khi chính người thắng cũng là người bắt 2. Có thể thêm các cặp bắt 2 khác nhau trong một ván; không cho chọn một người tự bắt mình hoặc trùng cùng cặp. Những khoản này tính vào tổng thắng/thua ròng và đối soát sau Done.

## Đồng bộ hai máy

- Hai máy cùng nhập **hai ván khác nhau** và danh sách người chơi không đổi: Firestore transaction có thể gộp hai ván.
- Nếu một máy đổi danh sách đang chơi **đồng thời** máy khác thêm ván theo danh sách cũ: máy thêm ván sẽ nhận cảnh báo; tải lại phiên rồi nhập ván theo danh sách mới. Điều này **cố ý** để tránh tính tiền người đã offline.
- Nếu hai máy sửa **cùng một ván**, ứng dụng giữ cơ chế cảnh báo xung đột từ v3.1.1.

## Đối soát tiền & lịch sử

`sessionStats` cộng tiền thắng/thua thông thường, Báo sâm/Cháy và chuyển độc lập Bắt 2. Tổng thắng bằng tổng thua. Sau Done, kết quả được chụp (`snapshot`), tiền chuyển khoản tính theo số ròng của tất cả người từng tham gia và các checkbox vẫn quyết định `Done/Paid` như trước.

**Ba ngày Done/Paid cũ trong ảnh vẫn giữ nguyên trong Firestore.** Trong **Báo cáo**, phần **Tổng hợp các phiên cùng ngày** sẽ cộng thắng/thua và số ván của những phiên có cùng ngày để mày xem kết quả chung. Đây chỉ là hiển thị: không tự động gộp thành một phiên vì điều đó thay đổi snapshot, khoản nợ và checkbox đã xác nhận. Nếu có hai buổi khác nhau trong cùng ngày, tổng hợp theo ngày sẽ bao gồm cả hai.

## Kiểm tra đã làm và giới hạn

- Các bài test logic thuần Node: xem kết quả bằng `npm test`.
- `npm run preflight` kiểm tra source/Rules.
- JSX đã kiểm tra cú pháp bằng TypeScript parser; **chưa chạy được `npm run build` trong môi trường tạo file nếu không cài được npm packages**. Bản build thực tế cần kiểm tra qua GitHub Actions.
- Firestore Rules mới **chưa được thử trên Firebase Emulator hoặc project thật** trong môi trường này. Hãy thử bằng một phiên mới ít tiền hoặc phiên kiểm thử trước khi sử dụng thực tế.
- Không bật Firestore công khai và không đổi tài khoản Admin hiện tại.
