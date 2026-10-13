/** `Authorization: Basic base64(admin:<ADMIN_PASSWORD>)`. Đọc process.env trực tiếp để proxy không cần đủ mọi biến môi trường. */
export function isAdminAuthorization(header: string | null): boolean {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !header?.startsWith('Basic ')) return false;
  const expected = `admin:${password}`;
  let given: string;
  try {
    given = atob(header.slice(6));
  } catch {
    return false;
  }
  // So sánh độ dài cố định để không lộ thông tin qua thời gian phản hồi.
  let diff = given.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= (given.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  return diff === 0;
}
