import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { projects } from "../../../../../db/schema";
import { logActivity } from "../../../../lib/activity";
import { getSessionUserFromRequest } from "../../../../lib/auth";
import { toRouteErrorMessage } from "../../../../lib/db-error";
import { isFactoryVisible } from "../../../../lib/project-utils";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me) return Response.json({ error: "الرجاء تسجيل الدخول" }, { status: 401 });

    const { id } = await context.params;
    const payload = (await request.json()) as { completionPercent: number };
    const value = Math.max(0, Math.min(100, Math.round(Number(payload.completionPercent) || 0)));

    const db = getDb();
    const [existing] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!existing) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });
    if (me.role === "factory" && !isFactoryVisible(existing.status)) {
      return Response.json({ error: "هذا المشروع غير معتمد بعد" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const [updated] = await db
      .update(projects)
      .set({ completionPercent: value, completionUpdatedAt: now, updatedAt: now })
      .where(eq(projects.id, id))
      .returning();

    if (existing.completionPercent !== value) {
      await logActivity({
        projectId: id,
        userId: me.id,
        userDisplayName: me.displayName || me.username,
        action: "progress_updated",
        details: `${value}%`,
      });
    }

    return Response.json({ project: { id: updated.id, completionPercent: updated.completionPercent, completionUpdatedAt: updated.completionUpdatedAt } });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
