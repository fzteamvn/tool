# DRAG AIM PRO X V8.0 — Netlify Server Key

Bộ source gồm app V8.0, trang Admin và Netlify Function để quản lý License Key. Dữ liệu key được lưu bằng Netlify Blobs.

## 6 chức năng
1. Admin tạo key tự động: 7 ngày, 30 ngày hoặc vĩnh viễn.
2. Key có hạn sử dụng và tự từ chối khi hết hạn.
3. Admin khóa/thu hồi key từ xa.
4. Mỗi key chỉ gắn với một mã cài đặt trình duyệt tại một thời điểm.
5. Admin xem danh sách key, trạng thái, hạn và tình trạng kích hoạt.
6. Admin gia hạn key và reset thiết bị để người dùng kích hoạt lại trên máy khác.

## Triển khai lên Netlify

**Lưu ý:** Đây là dự án có Netlify Functions. Không chỉ kéo riêng file `public` lên Netlify Drop vì cách đó chỉ đưa phần tĩnh lên và không triển khai backend Function. Dùng Git integration hoặc Netlify CLI để triển khai cả Function.

### Cách A — GitHub + Netlify (dễ cập nhật)
1. Giải nén ZIP này.
2. Đưa toàn bộ thư mục dự án lên một GitHub repository (giữ nguyên `netlify.toml`, `package.json`, `netlify/functions` và `public`).
3. Trong Netlify, chọn **Add new project → Import an existing project**, kết nối repository đó.
4. Build command để trống; Publish directory là `public` (đã cấu hình trong `netlify.toml`).
5. Sau khi site được tạo, vào **Project configuration → Environment variables** và thêm:
   - Key: `ADMIN_PASSWORD`
   - Value: tự đặt một mật khẩu dài, khó đoán (không dùng mật khẩu ví dụ trên mạng).
6. Trigger deploy lại sau khi thêm biến môi trường.
7. Mở trang app: `https://TEN-SITE.netlify.app/`
8. Mở trang Admin: `https://TEN-SITE.netlify.app/admin.html`

### Cách B — Netlify CLI
Cài Node.js và Netlify CLI, mở terminal tại thư mục dự án rồi chạy:

```bash
npm install
npm install -g netlify-cli
netlify login
netlify link
netlify env:set ADMIN_PASSWORD "MAT_KHAU_ADMIN_RIENG_CUA_BAN"
netlify deploy --prod
```

Nếu CLI báo chưa liên kết site, chạy `netlify link` và chọn đúng site Netlify đang dùng. CLI sẽ upload cả static files và Functions theo `netlify.toml`.

## Cách dùng
- Vào `/admin.html`, đăng nhập bằng giá trị `ADMIN_PASSWORD` đã đặt trên Netlify.
- Bấm **Tạo key**, chọn 7 ngày / 30 ngày / vĩnh viễn.
- Sao chép key vừa tạo và gửi cho người dùng. Key đầy đủ chỉ hiển thị một lần ở thời điểm tạo.
- Dùng nút **Khóa**, **Gia hạn**, **Reset máy** trong bảng để quản lý.
- Người dùng mở trang `/`, nhập key. Server xác thực và gắn key với thiết bị trình duyệt đầu tiên.

## Lưu ý bảo mật và giới hạn
- Không đưa `ADMIN_PASSWORD` vào HTML, JavaScript hoặc GitHub. Chỉ đặt trong Netlify Environment Variables.
- License key được lưu dạng SHA-256 hash trong Netlify Blobs; server mới giữ dữ liệu trạng thái/hạn sử dụng.
- Giới hạn thiết bị dựa trên ID cài đặt được lưu trong localStorage, không phải serial phần cứng bất biến. Đây là hệ thống license cơ bản, không phải DRM chống sao chép tuyệt đối.
- Mỗi lần mở app và định kỳ 5 phút, app gọi server để kiểm tra lại. Khi server không truy cập được hoặc key bị thu hồi/hết hạn, app khóa màn hình kích hoạt.
- Netlify Free có giới hạn credit theo tháng; theo dõi mức dùng trong mục Billing/Usage. Lưu lượng lớn có thể vượt mức miễn phí.
- Netlify Blobs phù hợp cho dự án nhỏ và ít ghi dữ liệu. Nếu có nhiều giao dịch đồng thời hoặc quy mô lớn, nên chuyển sang cơ sở dữ liệu giao dịch.
