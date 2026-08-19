import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { users } from "../../../../db/schema";
import { getSessionUserFromRequest } from "../../../lib/auth";
import { toRouteErrorMessage } from "../../../lib/db-error";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me || me.role !== "engineer") {
      return Response.json({ error: "هذه الصفحة مخصصة لحساب المهندس فقط" }, { status: 403 });
    }
    const { id } = await context.params;
    const targetId = Number(id);
    if (targetId === me.id) {
      return Response.json({ error: "لا يمكنك حذف حسابك الحالي" }, { status: 400 });
    }
    const db = getDb();
    await db.delete(users).where(eq(users.id, targetId));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
