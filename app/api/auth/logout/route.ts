import { destroySession, getSessionTokenFromRequest, clearSessionCookieHeader } from "../../../lib/auth";

export async function POST(request: Request) {
  const token = getSessionTokenFromRequest(request);
  if (token) {
    try {
      await destroySession(token);
    } catch {
      // نتجاهل فشل الحذف من القاعدة، المهم مسح الكوكيز محليًا
    }
  }
  const res = Response.json({ ok: true });
  res.headers.append("Set-Cookie", clearSessionCookieHeader());
  return res;
}
