# Triển khai Sổ Ván React lên GitHub Pages: `nam4eb/sam-JQK`

## Lưu ý về GitHub kết nối ChatGPT

Ứng dụng GitHub kết nối ChatGPT (connector) chủ yếu hỗ trợ **đọc mã nguồn**, không tự cấp khả năng push lên repository. Vì vậy bạn **không cần tìm ChatGPT trong tab Installed GitHub Apps để deploy**. Nếu muốn ChatGPT/Codex trực tiếp sửa hoặc push mã nguồn, dùng Codex (nếu tài khoản có quyền), hoặc dùng tài khoản GitHub của bạn để tải source lên.

## Cách 1 — tải source lên qua trình duyệt GitHub (không cần dòng lệnh)

1. Tải file ZIP của Sổ Ván và **giải nén trên máy tính**.
2. Mở https://github.com/nam4eb/sam-JQK, chọn nhánh `main`.
3. Bấm **Add file → Upload files**. Kéo các tệp và thư mục đã giải nén (gồm `src`, `public`, `index.html`, `package.json`, `vite.config.js`, `.gitignore`, `README.md`) vào GitHub. **Không tải trực tiếp file ZIP** vì GitHub Pages không thể chạy ZIP chứa source React.
4. Quan trọng: đảm bảo tệp `.github/workflows/deploy.yml` cũng được đưa lên. Nếu trình upload không nhận thư mục `.github` ẩn: quay về repo, chọn **Add file → Create new file**, nhập chính xác tên `.github/workflows/deploy.yml`, sao chép nội dung từ tệp cùng tên đã giải nén, bấm **Commit changes**.
5. Chọn **Commit changes** lên `main`.
6. Vào **Settings → Pages**, dưới **Build and deployment**, chọn **Source: GitHub Actions**.
7. Vào tab **Actions** để xem workflow **Deploy React to GitHub Pages**. Nếu cần, bấm **Run workflow** để chạy thủ công; có thể cần bật Actions lần đầu trên repo.
8. Chỉ khi workflow hoàn tất thành công, mở https://nam4eb.github.io/sam-JQK/ .

## Cách 2 — sử dụng Git trên máy tính

Giải nén ZIP rồi mở terminal **ngay trong thư mục có `package.json`**:

```bash
git clone https://github.com/nam4eb/sam-JQK.git
git -C sam-JQK switch main
# Sao chép nội dung source đã giải nén vào thư mục sam-JQK, bao gồm thư mục .github
git -C sam-JQK add .
git -C sam-JQK commit -m "Deploy So Van React"
git -C sam-JQK push origin main
```

Nếu thích, bạn có thể dùng GitHub Desktop để sao chép tệp vào thư mục clone, commit và push mà không cần terminal.

## Xác nhận cấu hình

- `vite.config.js` dùng `base: '/sam-JQK/'`.
- `.github/workflows/deploy.yml` chạy các bước `npm install`, `npm test`, `npm run build`, tải `dist` lên GitHub Pages.
- Đây là web app **không có backend**. Dữ liệu lưu trong localStorage từng trình duyệt/điện thoại; không tự đồng bộ giữa các thiết bị. Sao lưu JSON định kỳ.
- GitHub Pages là trang công khai. **Không commit dữ liệu chơi hay bản sao lưu có thông tin riêng tư lên repo public.**
