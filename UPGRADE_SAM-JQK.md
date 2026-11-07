# Nâng cấp Sâm JQK v2.1 lên GitHub Pages

Repository: https://github.com/nam4eb/sam-JQK

Trang web sau deploy: https://nam4eb.github.io/sam-JQK/

## Các thay đổi trong v2.1

1. **Đối soát thanh toán**: sau khi chốt `Done`, màn chi tiết phiên hiện danh sách chuyển tiền dựa trên lãi/lỗ **ròng của cả phiên**. Mỗi khoản có người gửi, người nhận, số tiền và checkbox.
2. **Trạng thái `Paid`**: tự đổi khi mọi khoản đã được xác nhận. Bỏ xác nhận một khoản sẽ đưa phiên trở lại `Done`; các ván đã chốt vẫn khóa và thống kê tháng không bị thay đổi.
3. **Ảnh QR thành viên**: vào Thành viên → Sửa/Thêm → Tải ảnh QR (PNG/JPG/WebP), xem QR của người nhận ngay trong danh sách thanh toán. QR được nén và lưu **trong localStorage**, không upload lên server. Nên sao lưu JSON thường xuyên vì ảnh có thể chiếm nhiều dung lượng.
4. Tên website, metadata, manifest và icon đã đổi thành **Sâm JQK**.
5. Vẫn dùng key lưu trữ `so-van/mobile-ledger/v1` của bản cũ: cập nhật code trên **cùng URL và cùng trình duyệt** sẽ đọc được ngày chơi đã lưu.

## Cách cập nhật repo (khuyên dùng GitHub Desktop)

- Trên máy tính, cài GitHub Desktop và **Clone** `nam4eb/sam-JQK` về máy.
- Giải nén file ZIP cập nhật này. Sao chép các file và thư mục (`src`, `public`, `index.html`, `package.json`, `README.md`, v.v.) vào thư mục clone, **ghi đè file cũ**. Không xóa `.git` trong thư mục clone.
- Trong GitHub Desktop, commit với nội dung `feat: paid settlement, member QR, rebrand Sam JQK`, rồi chọn **Push origin**.
- Mở tab Actions của repo. Workflow `.github/workflows/deploy.yml` sẽ tự chạy; sau khi trạng thái `success`, kiểm tra trang web trên điện thoại.

Hoặc dùng Git CLI:

```bash
git clone https://github.com/nam4eb/sam-JQK.git
cd sam-JQK
# Sao chép toàn bộ source đã giải nén vào đây (ghi đè bản cũ).
npm install
npm test
npm run build
git add -A
git commit -m "feat: paid settlement, member QR, rebrand Sam JQK"
git push origin main
```

Đường dẫn Vite vẫn là `/sam-JQK/`; workflow hiện tại không cần sửa.

## Cảnh báo dữ liệu

- Dữ liệu cũ sẽ được giữ nếu mở website **đúng URL cũ**, **đúng trình duyệt** và chưa xóa dữ liệu website. Trước khi cập nhật nên vào **Cài đặt → Tải bản sao JSON**.
- `Paid` chỉ là xác nhận thủ công của người dùng, ứng dụng không kiểm tra giao dịch ngân hàng.
- Mỗi điện thoại vẫn có dữ liệu riêng, chưa có đồng bộ đa thiết bị.
- Nếu upload QR quá nhiều, localStorage của trình duyệt có thể đầy. Khi không lưu được, hãy giảm số ảnh hoặc xuất JSON sao lưu; đừng xóa dữ liệu web trước khi đã sao lưu.

## Trạng thái kiểm tra nguồn

- `npm test`: **8/8 passed**, gồm kiểm tra lịch sử bản cũ, Done/Paid, nhiều người thắng và checkbox quay lại Done.
- Cú pháp JSX đã được kiểm tra bằng trình phân tích TypeScript, không có lỗi cú pháp.
- Build Vite thực tế trên máy tạo file này **chưa chạy được vì mạng npm bị chặn**. GitHub Actions sẽ chạy bước `npm install`, `npm test`, `npm run build` trên máy chủ GitHub sau khi source được push.
