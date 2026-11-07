# Sâm JQK — React web app (mobile first)

Ứng dụng tính tiền bài theo từng ván, xây bằng **React 19 + Vite**. Thiết kế cho điện thoại, không yêu cầu database, backend hay đăng nhập. Có thể deploy lên GitHub Pages.

## Chức năng mới (v2.1)

- **Thanh toán:** chốt Done, đối soát các khoản chuyển ròng từ người thua sang người thắng; tick từng khoản, tự cập nhật Paid khi đủ và cho phép bỏ tick để sửa.
- **QR từng thành viên:** quản lý ảnh QR trong màn Thành viên; hiển thị QR người nhận khi thanh toán, lưu trong JSON backup cục bộ.
- **Lịch sử:** báo cáo vẫn tính cả các phiên Done và Paid. Bản cũ tự đọc được mà không mất lịch sử.

## Chức năng

- **Thành viên:** thêm, sửa, tạm ngưng; lịch sử liên kết qua ID, không mất khi đổi tên.
- **Ngày chơi:** tạo ngày mới, chọn 2–10 thành viên (không cố định 5 người), không có ván sẵn.
- **Từng ván:** chọn 1 người thắng, nhập số thua của những người còn lại. Người thắng nhận tổng tiền thua. Chỉnh sửa hoặc xóa ván chưa chốt.
- **Quản lý:** xóa các ván (giữ tên), làm trắng ngày (xóa cả tên và ván), xóa phiên Active chưa có ván.
- **Done:** khóa ngày, lưu snapshot và đưa số liệu vào báo cáo tháng. Không xóa dữ liệu lịch sử.
- **Tự chốt:** phiên Active có ván sau số ngày đã chọn (mặc định 7), được kiểm tra khi mở/đang dùng web; không chạy khi trang đóng.
- **Báo cáo:** tiền thua, thắng, lãi/lỗ ròng, số ván/người, ngày đã Done và biểu đồ 12 tháng.
- **Sao lưu:** xuất JSON toàn bộ, khôi phục JSON, xuất CSV báo cáo tháng để xem trong Excel.

## Chạy local

Yêu cầu Node.js 20.19+ hoặc 22.12+ (khuyên dùng Node 22).

```bash
npm install
npm run dev
# Mở địa chỉ local được in ra
```

Kiểm tra logic:

```bash
npm test
npm run build
npm run preview
```

## Triển khai lên GitHub Pages `nam4eb/sam-JQK`

Repository và workflow đã tồn tại. Để nâng cấp, clone repo, chép các file cập nhật vào thư mục clone, commit và push lên nhánh `main`. GitHub Actions sẽ tự test, build rồi deploy lên **<https://nam4eb.github.io/sam-JQK/>**.

Hướng dẫn chi tiết có trong **`UPGRADE_SAM-JQK.md`**.

## Dữ liệu & riêng tư

- Lưu trong `localStorage` của **từng thiết bị / trình duyệt** (key `so-van/mobile-ledger/v1`, giống bản web tĩnh trước để giữ dữ liệu nếu cùng origin). Dữ liệu **không** được gửi lên repo GitHub.
- Không đồng bộ giữa iPhone/Android/laptop. Muốn sử dụng chung sổ tiền cần thêm backend, xác thực, phân quyền và cơ sở dữ liệu.
- Xóa cache / website data, đổi thiết bị hoặc dùng tab ẩn danh có thể làm mất dữ liệu; **xuất JSON thường xuyên**.
- Ứng dụng không có tài khoản hay API. Công khai website trên GitHub Pages **không** làm công khai dữ liệu trong `localStorage` của thiết bị.
- Giới hạn 100 thành viên, 10 người/phiên, 200 ván/phiên. Lưu trữ của browser cũng có giới hạn dung lượng.
- Đây là bản React chạy thuần client; cần kết nối mạng để tải app khi mở lần đầu. Chưa có đồng bộ liên thiết bị.

## Cấu trúc thư mục

```text
so-van-react/
├── .github/workflows/deploy.yml     # CI/CD GitHub Pages
├── index.html                       # Vite entry
├── src/
│   ├── main.jsx                     # React bootstrap
│   ├── App.jsx                      # Screens, dialogs, actions
│   ├── ledger.js                    # Storage + business rules
│   ├── ledger.test.js               # Unit tests
│   └── styles.css                   # Mobile-first CSS
├── public/
│   ├── manifest.webmanifest
│   └── assets/                      # app icons
├── package.json
└── vite.config.js
```

> GitHub Pages: vào **Settings → Pages → Source: GitHub Actions** để kích hoạt nếu chưa bật. Website chỉ khả dụng sau khi workflow Deploy hoàn tất.
