# HoànTiền

App hoàn tiền khi mua trên Shopee, Lazada và TikTok Shop. Người dùng dán hoặc chia sẻ link sản phẩm vào app. App đổi link đó thành link affiliate có gắn mã theo dõi riêng cho người dùng, rồi mở app sàn để họ mua. Khi sàn duyệt đơn, phần lớn hoa hồng (mặc định 70%) được cộng vào ví của người dùng để rút về ngân hàng.

## Ảnh màn hình

### App mobile

| Trang chủ | Xem trước | Đơn hàng | Ví | Tài khoản |
|---|---|---|---|---|
| <img src="docs/screenshots/mobile-home.png" width="180" alt="Trang chủ: ô dán link, cách nhận hoàn tiền, link gần đây"> | <img src="docs/screenshots/mobile-preview.png" width="180" alt="Xem trước sản phẩm với số tiền hoàn ước tính và nút Mua ngay"> | <img src="docs/screenshots/mobile-orders.png" width="180" alt="Danh sách đơn chờ duyệt kèm ngày duyệt dự kiến"> | <img src="docs/screenshots/mobile-wallet.png" width="180" alt="Ví: số dư có thể rút, đang chờ duyệt, lịch sử"> | <img src="docs/screenshots/mobile-account.png" width="180" alt="Tài khoản: đăng xuất, câu hỏi thường gặp, xoá tài khoản"> |

Ảnh chụp từ bản web của app (`expo export --platform web`) ở khổ iPhone, dùng dữ liệu mẫu. Bản web vẽ thanh tab nổi ở phía trên; khi chụp, thanh tab được đặt lại ở đáy cho giống trên điện thoại. Nút Sign in with Apple chỉ hiện trên iOS nên không có trong ảnh.

### Trang admin

| Tổng quan | Lệnh rút tiền | Đơn hàng |
|---|---|---|
| <img src="docs/screenshots/admin-overview.png" width="300" alt="Tổng quan: số link, đơn chờ duyệt, đơn không khớp click, trạng thái cron"> | <img src="docs/screenshots/admin-withdrawals.png" width="300" alt="Lệnh rút tiền chờ xử lý với nút Đã chuyển và Từ chối"> | <img src="docs/screenshots/admin-conversions.png" width="300" alt="Danh sách đơn từ các sàn, hoa hồng và phần hoàn cho người dùng"> |

Dữ liệu trong ảnh được tạo qua API thật của backend ở chế độ `AFFILIATE_MODE=mock`.

## Cách hoạt động

1. Người dùng bấm **Chia sẻ** trong app sàn rồi chọn HoànTiền, hoặc dán link vào app.
2. Backend lấy mã sản phẩm từ link, tạo một `click_id` riêng, rồi gọi API affiliate của sàn để tạo link có `sub_id = click_id`.
3. Khi người dùng bấm **Mua ngay**, app mở thẳng link affiliate để app sàn ghi nhận lượt giới thiệu.
4. Cron trên Vercel kéo báo cáo đơn từ sàn và khớp `sub_id` với người dùng. Đơn được duyệt khi sàn báo hoàn tất và đã hết hạn đổi trả. Khi đó tiền chuyển từ "chờ duyệt" sang "có thể rút".

Thiết kế chi tiết (system design, UI/UX, deployment, rủi ro): [docs/design.html](docs/design.html), bản xem online: https://claude.ai/artifact/9PVERQExzFgboCwdmwLw2Q

## Cấu trúc

```
mobile/    App iOS / Android: React Native, Expo SDK 57, Expo Router
backend/   API, trang admin, cron: Next.js 16 trên Vercel, Postgres + Drizzle
docs/      Tài liệu thiết kế và ảnh màn hình
```

## Chạy thử

Backend (cần Docker để chạy Postgres):

```bash
cd backend
docker run -d --name hoantien-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=hoantien -p 55432:5432 postgres:17-alpine
cp .env.example .env.local      # điền CRON_SECRET, AUTH_SECRET, ADMIN_PASSWORD
npm install
DATABASE_URL=postgres://postgres:test@localhost:55432/hoantien npm run db:migrate
npm run dev                     # http://localhost:3000, admin ở /admin
```

App mobile:

```bash
cd mobile
npm install
npx expo run:android                                        # dữ liệu mẫu, không cần backend
EXPO_PUBLIC_API_URL=http://<IP máy>:3000 npx expo run:android   # nối backend local
```

App dùng share extension nên không chạy trong Expo Go; lệnh `expo run` tạo development build. Xem thêm [mobile/README.md](mobile/README.md) và [backend/README.md](backend/README.md).

## Kiểm tra

```bash
cd backend && npm run typecheck && npm run lint && npm test
cd backend && TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/hoantien npm test   # thêm integration test trên Postgres
cd mobile && npx tsc --noEmit && npx expo lint && npx expo-doctor
```

## Trạng thái

Đã có app mobile, backend và trang admin, chạy trọn luồng với dữ liệu mẫu. Còn thiếu trước khi ra mắt:

- Đối chiếu tích hợp Shopee với tài liệu chính thức và tài khoản affiliate thật
- Tích hợp Lazada và TikTok Shop (trực tiếp hoặc qua affiliate network)
- Nhà cung cấp SMS cho mã OTP
- Khoá Sign in with Apple (.p8) để thu hồi token khi xoá tài khoản
- Icon, màn hình khởi động và tên định danh app (`vn.hoantien.app` là tên tạm)
- Kiểm tra điều khoản affiliate của từng sàn với mô hình hoàn tiền
