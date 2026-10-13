# HoànTiền — app mobile

App iOS / Android viết bằng React Native (Expo SDK 57, Expo Router). Người dùng dán hoặc chia sẻ link sản phẩm từ Shopee, Lazada, TikTok Shop, xem số tiền hoàn ước tính rồi mở app sàn để mua.

## Chạy thử

```bash
npm install
npx expo run:android      # hoặc: npx expo run:ios (cần macOS + Xcode)
```

App dùng `expo-share-intent` (share extension trên iOS, intent filter trên Android) nên **không chạy được trong Expo Go**; lệnh trên tạo development build. Không có máy Mac thì build iOS trên cloud: `npx eas-cli@latest build --profile development --platform ios`.

Khi chưa có backend, app tự dùng dữ liệu mẫu trong `src/lib/mock.ts` (đăng nhập bằng số điện thoại bất kỳ, mã OTP 6 số bất kỳ). Để nối backend thật:

```bash
EXPO_PUBLIC_API_URL=https://staging.hoantien.app npx expo start
```

## Cấu trúc

```
src/
  app/                    # mỗi file là một màn hình (Expo Router)
    _layout.tsx           # ShareIntentProvider, SessionProvider, Stack
    +native-intent.ts     # chuyển link từ iOS share extension về Trang chủ
    (tabs)/               # 4 tab: Trang chủ, Đơn hàng, Ví, Tôi
    preview.tsx           # xem trước sản phẩm + nút "Mua ngay"
    login.tsx             # đăng nhập SĐT + OTP
    withdraw.tsx          # yêu cầu rút tiền
    help.tsx              # câu hỏi thường gặp
  components/             # GradientHeader, Button, Card, CashbackBadge…
  constants/theme.ts      # bảng màu tông sáng, spacing, cỡ chữ
  lib/
    api.ts                # gọi backend; danh sách endpoint ở đầu file
    mock.ts               # dữ liệu mẫu khi chưa có backend
    links.ts              # nhận diện sàn, tách link khỏi đoạn chữ chia sẻ
    session.tsx           # token đăng nhập lưu trong SecureStore
    use-async.ts          # tải dữ liệu, loading/error, tải lại khi quay về màn hình
```

## Kiểm tra trước khi commit

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

## Phát hành lên store

Cần tài khoản Apple Developer Program và Google Play Console. Đổi `bundleIdentifier` / `package` trong `app.json` (hiện là `vn.hoantien.app`) và thay icon, splash trong `assets/` trước lần build đầu.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios       # lên TestFlight
npx eas-cli@latest submit --profile production --platform android   # lên track internal
```

Sửa lỗi chỉ ở phần JavaScript có thể đẩy ngay cho người dùng mà không cần duyệt lại bằng `npx eas-cli@latest update --channel production` (cần thêm `expo-updates`).

`eas.json` có ba profile: `development` (dữ liệu mẫu), `preview` (staging) và `production`.
