import { getShareExtensionKey } from 'expo-share-intent';

/**
 * iOS share extension mở app bằng link dạng `hoantien://dataUrl=<key>…`, không khớp route nào.
 * Chuyển về Trang chủ; màn hình đó đọc nội dung chia sẻ qua useShareIntentContext.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) return '/';
    return path;
  } catch {
    return '/';
  }
}
