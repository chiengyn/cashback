const vnd = new Intl.NumberFormat('vi-VN');
const dateTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });

export const formatVnd = (amount: number) => `${vnd.format(amount)}₫`;
export const formatDateTime = (d: Date) => dateTime.format(d);
