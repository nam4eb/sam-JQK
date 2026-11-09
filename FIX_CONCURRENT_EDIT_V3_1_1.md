# Sâm JQK v3.1.1 — sửa lỗi xung đột khi hai điện thoại nhập ván

## Lỗi được sửa

Bản v3.1 so sánh *toàn bộ document phiên* với snapshot cũ trước khi ghi. Nếu A nhập ván 1 và B nhập ván 2 gần như cùng lúc, B bị lỗi "Có dữ liệu mới từ điện thoại khác...". Giao diện có `onSnapshot` nhưng các cập nhật có thể đến chậm hơn thao tác của người dùng.

Bản vá sử dụng giao dịch Firestore để đọc document mới nhất, sau đó *gộp thay đổi trên đúng một ván* khi không xung đột. Các dữ liệu khác vẫn giữ. Tuyệt đối không dùng last-write-wins cho toàn bộ `rounds`.

## Hành vi mới

| Tình huống | Kết quả |
|---|---|
| Hai máy thêm hai ván khác nhau | Lưu cả hai (gộp trong transaction) |
| Hai máy sửa hai ván khác nhau | Lưu cả hai thay đổi |
| Hai máy sửa **cùng một ván** với tiền khác nhau | Chặn thao tác sau, yêu cầu kiểm tra lại |
| Máy A chốt Done, máy B nhập ván muộn | Chặn ván muộn, không mở lại ngày đã chốt |
| Hai máy đánh dấu thanh toán **khác khoản** | Gộp; đủ khoản sẽ thành Paid |
| Xóa toàn bộ các ván khi người khác vừa nhập | Chặn để tránh mất ván của người khác |
| Firestore trả các field của map theo thứ tự khác nhau | Không báo xung đột giả |

Firestore transaction có thể được chạy lại bởi SDK nếu một thiết bị khác ghi trước khi transaction commit. Không hỗ trợ ghi offline trong bản này.

## Triển khai qua GitHub/Codex

**Chỉ có 2 file runtime cần cập nhật, không cần thay Firestore Rules, không cần xóa dữ liệu hiện tại:**

1. Sao lưu JSON ở Sâm JQK (Admin → Cài đặt → Tải bản sao JSON).
2. Trên repo `nam4eb/sam-JQK`, **thêm file mới `src/concurrency.js`** từ gói ZIP.
3. **Thay nội dung `src/cloud.js`** bằng bản đã sửa trong ZIP. Đây là bản dựa trên source v3.1 ở main tại thời điểm phân tích. Hoặc áp dụng `fix-concurrency.patch` lên source hiện tại để chỉ sửa vài dòng.
4. Tuỳ chọn: thêm `src/concurrency.test.js` để test trên GitHub Actions.
5. Commit và push lên `main`. Workflow `Deploy React to GitHub Pages` tự chạy `npm test` và `npm run build`. Kiểm tra xanh trước khi dùng dữ liệu thật.
6. Mở lại web trên **cả hai máy** (reload để lấy mã JavaScript mới), thử cùng phiên Active: mỗi máy nhập một ván khác nhau, xác nhận tổng số ván tăng 2 và tổng thắng/thua bằng 0.

**Không cần:** sửa `firestore.rules`, tạo collection mới, cấu hình Firebase lại, nhập lại lịch sử, đổi domain.

## Nếu dùng Codex

Giao nhiệm vụ: "Trong repo `nam4eb/sam-JQK`, áp dụng hai file `src/cloud.js` và `src/concurrency.js` từ gói Sâm JQK v3.1.1 này, bổ sung `src/concurrency.test.js`, chạy test, build, mở PR và merge khi các check thành công. Tuyệt đối không ghi đè dữ liệu Firestore, không thay đổi Rules hoặc các màn hình hiện có."

## Kiểm tra tự động

- `npm test` — 31/31 bài kiểm thử logic đạt trên Node 22.
- `npm run preflight` — đạt.
- `node --check src/cloud.js` và `node --check src/concurrency.js` — đạt.
- Chưa chạy production build trong môi trường tạo bản vá do không có npm package cache. GitHub Actions là bước kiểm chứng production build sau khi push.
- Chưa kiểm thử giao dịch với Firebase thật trên 2 điện thoại; nên xác nhận trên phiên thử trước.

## Lưu ý khi nhiều người cập nhật

Ứng dụng hiện lưu mọi ván trong một document phiên. Bản vá làm việc đồng thời dễ hơn cho nhóm khoảng 10 người, nhưng nếu thường xuyên có nhiều lần ghi mỗi giây lên cùng một phiên, nên tách từng ván thành subcollection `rounds` để giảm cạnh tranh trên một document. Đây là cải tiến kiến trúc về sau, không cần để giải quyết lỗi hiện tại.
