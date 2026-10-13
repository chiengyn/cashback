/**
 * Bảng màu tông sáng kiểu sàn TMĐT. App chỉ có giao diện sáng (userInterfaceStyle: "light" trong app.json).
 * Màu chính là cam hồng riêng, không trùng mã màu của sàn nào.
 */
export const Colors = {
  primary: '#FF5B2E',
  primaryEnd: '#FF3D6E',
  cashback: '#FFC93C',
  money: '#13A150',
  background: '#FFF4EF',
  card: '#FFFFFF',
  text: '#231A16',
  textSecondary: '#85766F',
  border: '#F3E3DC',
  noteBackground: '#FFF1C9',
  noteText: '#7A5300',
  pendingBackground: '#FFF1C9',
  pendingText: '#8A5D00',
  approvedBackground: '#DCF5E6',
  approvedText: '#0D7A3C',
  cancelledBackground: '#F1ECEA',
  cancelledText: '#85766F',
  danger: '#D93025',
  onPrimary: '#FFFFFF',
} as const;

export const HeaderGradient = [Colors.primary, Colors.primaryEnd] as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const FontSize = {
  caption: 12,
  body: 14,
  bodyLarge: 16,
  title: 20,
  price: 22,
  balance: 32,
} as const;
