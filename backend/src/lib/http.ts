import { z } from 'zod';

/** Lỗi trả về cho app; `message` hiển thị thẳng cho người dùng nên viết tiếng Việt. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Bọc route handler: đổi HttpError / lỗi validate thành JSON `{ message }`, log lỗi còn lại. */
export function route<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return json({ message: e.message }, e.status);
      if (e instanceof z.ZodError) {
        return json({ message: e.issues[0]?.message ?? 'Dữ liệu gửi lên không hợp lệ.' }, 400);
      }
      console.error(`[${req.method} ${new URL(req.url).pathname}]`, e);
      return json({ message: 'Máy chủ đang bận, bạn thử lại sau ít phút.' }, 500);
    }
  };
}

export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const body = await req.json().catch(() => {
    throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ.');
  });
  return schema.parse(body);
}
