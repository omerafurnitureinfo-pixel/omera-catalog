import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { verifyPassword, createSession, sessionCookieHeader } from "../../../lib/auth";
import { toRouteErrorMessage } from "../../../lib/db-error";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { username?: string; password?: string; role?: string };
    const username = (payload.username ?? "").trim();
    const password = payload.password ?? "";
    const expectedRole = payload.role === "factory" ? "factory" : payload.role === "engineer" ? "engineer" : null;

    if (!username || !password || !expectedRole) {
      return Response.json({ error: "أدخل اسم المستخدم وكلمة المرور" }, { status: 400 });
    }

    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    if (!user) {
      return Response.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
    }
    const valid = await verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!valid) {
      return Response.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
    }
    if (user.role !== expectedRole) {
      const roleName = user.role === "engineer" ? "قسم المهندس" : "قسم المصنع";
      return Response.json({ error: `هذا الحساب مخصص لـ ${roleName}. سجّل الدخول من البوابة الصحيحة.` }, { status: 403 });
    }

    const { token, expiresAt } = await createSession(user.id);
    const res = Response.json({
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
    });
    res.headers.append("Set-Cookie", sessionCookieHeader(token, expiresAt));
    return res;
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
