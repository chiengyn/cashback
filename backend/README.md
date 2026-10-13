# HoànTiền — backend

Next.js 16 (App Router) trên Vercel + Postgres (Drizzle ORM). Phục vụ API cho app mobile, trang `/r/{click_id}`, cron đồng bộ đơn và trang admin.

## Chạy local

```bash
docker run -d --name hoantien-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=hoantien -p 55432:5432 postgres:17-alpine
cp .env.example .env.local        # điền CRON_SECRET, AUTH_SECRET, ADMIN_PASSWORD
npm install
DATABASE_URL=postgres://postgres:test@localhost:55432/hoantien npm run db:migrate
npm run dev
```

Mặc định `AFFILIATE_MODE=mock`: không gọi API sàn, link affiliate là link gốc kèm `?sub_id=`, và mỗi lần bấm "Mua ngay" sinh một đơn giả (hoàn tất sau 2 phút). Mã OTP in ra log server (`[sms] 0912345678: 123456`).

Nối app mobile: `EXPO_PUBLIC_API_URL=http://<IP máy>:3000 npx expo start` trong `mobile/`.

Chạy cron bằng tay:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/sync-orders/purchase
```

Trang admin: `http://localhost:3000/admin`, đăng nhập `admin` / `ADMIN_PASSWORD`.

## Kiểm tra

```bash
npm run typecheck
npm run lint
npm test                                                     # chỉ unit test
TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/hoantien npm test   # thêm integration test
npx vitest run src/lib/cashback.test.ts                      # một file
```

Integration test xoá sạch dữ liệu (TRUNCATE) trong database đó, đừng trỏ vào database thật.

## API

| Endpoint | Đăng nhập | Ghi chú |
|---|---|---|
| `POST /api/auth/otp` `{ phone }` | | Giới hạn 1 mã/phút, 5 mã/giờ mỗi số, 10 mã/giờ mỗi IP |
| `POST /api/auth/verify` `{ phone, code }` | không bắt buộc | Trả `{ token, phone }`, dùng làm `Authorization: Bearer`. Gửi kèm token của tài khoản Apple thì gắn số điện thoại vào tài khoản đó |
| `POST /api/auth/apple` `{ identityToken, authorizationCode }` | | Sign in with Apple; tài khoản mới có `phone: null` |
| `POST /api/links` `{ url }` | không bắt buộc | Nhận cả đoạn chữ chia sẻ; dùng lại click nếu cùng user dán cùng sản phẩm trong 24 giờ |
| `POST /api/clicks/{id}/open` | có | Ghi lượt bấm, trả `{ affiliateUrl }`; gắn click ẩn danh cho user |
| `GET /api/links/recent`, `/api/orders`, `/api/wallet` | có | |
| `POST /api/withdrawals` | có | Cần có số điện thoại; khoá dòng user để hai lệnh rút cùng lúc không tiêu chung số dư |
| `DELETE /api/account` | có | Bỏ SĐT và liên kết Apple, xoá session, thu hồi token Apple (yêu cầu của App Store / Google Play) |
| `GET /r/{clickId}` | | 302 sang link affiliate, cho link mở bằng trình duyệt |
| `GET /api/cron/sync-orders/{purchase\|complete\|reconcile}` | `CRON_SECRET` | Lịch trong `vercel.json` |
| `GET /api/health` | | Kiểm tra cả kết nối database |

Lỗi luôn có dạng `{ message }` bằng tiếng Việt; app hiển thị thẳng cho người dùng.

## Đồng bộ đơn

Ba cron, mỗi sàn một khoá riêng trong bảng `cron_jobs` (`<platform>:<mode>`):

- `purchase` (mỗi 30 phút): đơn đặt từ mốc lần trước lùi 6 giờ.
- `complete` (phút 15 và 45): đơn vừa hoàn tất. Tách khỏi `purchase` vì `scrollId` của Shopee hết hạn sau 30 giây và hai truy vấn mới phải cách nhau hơn 30 giây.
- `reconcile` (03:10 giờ VN): quét lại 60 ngày để bắt đơn bị huỷ / trả hàng.

Đơn được duyệt (cộng vào số dư khả dụng) khi sàn báo hoàn tất và đã qua `APPROVAL_HOLD_DAYS` ngày. Sau mỗi lần chạy, `promoteMatured` chuyển các đơn đủ điều kiện mà không cần gọi API sàn. Quy tắc ghi sổ cái nằm trong `src/lib/cashback.ts` (`planLedger`).

## Còn thiếu trước khi chạy thật

- **Shopee:** tên field, cách ký và các giá trị trạng thái trong `src/platforms/shopee.ts` lấy từ tài liệu bên thứ ba. Cần đối chiếu với tài liệu chính thức và thử với tài khoản affiliate thật.
- **Lazada, TikTok Shop:** chưa có adapter thật; ở chế độ `live`, API trả lỗi "Chưa hỗ trợ hoàn tiền cho …".
- **Sign in with Apple:** bật capability cho App ID, tạo khoá .p8 và điền `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`; chưa thử với Apple thật (test dùng khoá tự sinh).
- **SMS:** chỉ có `console`. Cần chọn nhà cung cấp SMS brandname và thêm vào `src/lib/sms.ts`.

## Deploy

Vercel chạy `vercel-build` (`drizzle-kit migrate && next build`), nên migration áp dụng trước mỗi lần build. Đặt các biến trong `.env.example` ở Vercel; `DATABASE_URL` dùng URL của connection pooler. Tạo migration mới sau khi sửa `src/db/schema.ts`: `npm run db:generate`.
