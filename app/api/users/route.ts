import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { getSessionUserFromRequest, hashPassword, isRole } from "../../lib/auth";
import { toRouteErrorMessage } from "../../lib/db-error";

export async function GET(request: Request) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me || me.role !== "engineer") {
      return Response.json({ error: "هذه الصفحة مخصصة لحساب المهندس فقط" }, { status: 403 });
    }
    const db = getDb();
    const rows = await db.select().from(users);
    const list = rows.map((u) => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role, createdAt: u.createdAt }));
    return Response.json({ users: list });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me || me.role !== "engineer") {
      return Response.json({ error: "هذه الصفحة مخصصة لحساب المهندس فقط" }, { status: 403 });
    }
    const payload = (await request.json()) as { username?: string; password?: string; displayName?: string; role?: string };
    const username = (payload.username ?? "").trim();
    const password = payload.password ?? "";
    const displayName = (payload.displayName ?? "").trim() || username;
    const role = isRole(payload.role) ? payload.role : null;

    if (!username || username.length < 3) {
      return Response.json({ error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return Response.json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }, { status: 400 });
    }
    if (!role) {
      return Response.json({ error: "حدد نوع الحساب: مهندس أو مصنع" }, { status: 400 });
    }

    const db = getDb();
    const { hash, salt } = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({ username, passwordHash: hash, passwordSalt: salt, role, displayName })
      .returning();

    return Response.json({ user: { id: created.id, username: created.username, displayName: created.displayName, role: created.role } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
