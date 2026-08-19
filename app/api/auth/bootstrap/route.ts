import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { hashPassword, createSession, sessionCookieHeader } from "../../../lib/auth";
import { toRouteErrorMessage } from "../../../lib/db-error";

// هذا المسار يعمل مرة واحدة فقط: إذا كان جدول المستخدمين فارغًا بالكامل،
// يسمح بإنشاء أول حساب (بصلاحية مهندس دائمًا). بعد ذلك يرفض أي محاولة أخرى،
// وتتم إدارة بقية الحسابات من داخل النظام نفسه بعد تسجيل الدخول.
export async function GET() {
  try {
    const db = getDb();
    const existing = await db.select().from(users).limit(1);
    return Response.json({ needsSetup: existing.length === 0 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { username?: string; password?: string; displayName?: string };
    const username = (payload.username ?? "").trim();
    const password = payload.password ?? "";
    const displayName = (payload.displayName ?? "").trim() || username;

    if (!username || username.length < 3) {
      return Response.json({ error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return Response.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
    }

    const db = getDb();
    const existing = await db.select().from(users).limit(1);
    if (existing.length > 0) {
      return Response.json({ error: "تم إعداد النظام مسبقًا. يمكنك تسجيل الدخول مباشرة." }, { status: 409 });
    }

    const { hash, salt } = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({ username, passwordHash: hash, passwordSalt: salt, role: "engineer", displayName })
      .returning();

    const { token, expiresAt } = await createSession(created.id);
    const res = Response.json({
      user: { id: created.id, username: created.username, displayName: created.displayName, role: created.role },
    });
    res.headers.append("Set-Cookie", sessionCookieHeader(token, expiresAt));
    return res;
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
