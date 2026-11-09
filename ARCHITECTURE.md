# Thiết kế Firestore — Sâm JQK v3.0

## Dữ liệu (một nhóm duy nhất)

```text
groups/sam-jqk (document cha dùng cho Console)
  /access/{firebaseAuthUid}            {uid, email, role, active}
  /members/{permanentPlayerId}          {id, name, active, qrImage, ...}
  /sessions/{sessionId}                 {id, date, memberIds, rounds[], status, snapshot,
                                        payments, transferIds, paidAt, ...}
  /config/main                          {unit, archiveDays, updatedAt, updatedBy}
  /meta/main                            {mode: 'ready'|'migrating', ...}
```

- **UID tài khoản ≠ mã người chơi:** một người trong danh sách ván có ID `TVnnn`, còn UID Google là định danh quyền truy cập. Bản v3 chưa gắn quyền xác nhận vào từng người chơi; Admin/Editor có quyền tích khoản thanh toán để đối soát.
- **Lịch sử bất biến:** `Done`/`Paid` lưu rounds và snapshot; chỉ payments/status/paidAt được cập nhật sau chốt.
- **Lãi/lỗ ròng:** từ rounds tính mỗi người thắng/thua trong cả phiên; tạo các khoản chuyển ròng từ người thua sang người thắng; tất cả khoản chuyển đã check -> Paid.
- **Realtime:** `onSnapshot` vào `members`, `sessions`, `config`, `meta`, cùng quyền riêng của UID. Có 10 người -> cùng một sổ.
- **Concurrency:** mọi thao tác bình thường tác động **một document** qua Firestore `runTransaction`, so sánh phiên bản đọc trước với bản trên server; nếu xung đột trả lỗi rõ ràng thay vì ghi đè. Việc tải toàn bộ tập dữ liệu trong realtime là lựa chọn đơn giản cho nhóm nhỏ; nếu lớn cần truy vấn theo tháng/phân trang.
- **Migration:** Admin kiểm tra sổ trống, đặt `meta.mode=migrating`, ghi batch tối đa 5 document/lần, đặt `ready` sau cùng; retry cùng file JSON + UID được chấp nhận. Không động vào `localStorage` nguồn.
- **QR:** nén dưới ~220KB cho ảnh mới, lưu trong `members/{playerId}.qrImage`, không dùng Cloud Storage. Ảnh QR cũ lên tới 700KB có thể được chấp nhận nếu document nằm dưới giới hạn.

## Vai trò

| Vai trò | Xem | Ghi ván Active, QR, Done, Paid | Cài đặt nhóm / cấp quyền / chuyển dữ liệu |
|---|---|---|---|
| Admin | Có | Có | Có |
| Editor | Có | Có | Không |
| Viewer | Có | Không | Không |
| Chưa được cấp UID | Không | Không | Không |

Tất cả trình duyệt cần Internet khi commit transaction. `GoogleAuthProvider` dùng popup; một số trình duyệt điện thoại hạn chế popup, hãy thử Chrome/Safari chính thức, không ở chế độ duyệt riêng.

## Tăng cường bảo mật nên làm sau khi ổn định

- Firestore Rules Emulator để test các thao tác trái quyền; App Check khi có thời gian.
- Xem xét tách QR ảnh sang cách khác nếu dung lượng lớn, hoặc tạo QR VietQR từ thông tin ngân hàng đã đồng ý lưu.
- Xây lịch sử audit riêng nếu cần truy tìm người sửa; `updatedBy` hiện lưu UID cuối cùng nhưng không phải nhật ký bất biến.
- Nếu cần chống gian lận giữa Editors, xác thực tổng tiền và duyệt Paid bằng backend tin cậy (Cloud Functions/Cloud Run) thay vì chỉ client.
