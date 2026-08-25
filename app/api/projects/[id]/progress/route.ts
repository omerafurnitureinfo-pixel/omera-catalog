import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { projects } from "../../../../../db/schema";
import { logActivity } from "../../../../lib/activity";
import { getSessionUserFromRequest } from "../../../../lib/auth";
import { toRouteErrorMessage } from "../../../../lib/db-error";
import { WORK_STAGES, isFactoryVisible, parseStages, stagesToPercent } from "../../../../lib/project-utils";

// نسبة الإنجاز تُشتق من المراحل المؤشَّرة (كل مرحلة 25%) ولا تُرسَل مباشرة،
// حتى تبقى النسبة والمراحل متطابقتين دائمًا.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me) return Response.json({ error: "الرجاء تسجيل الدخول" }, { status: 401 });
    if (me.role !== "factory") {
      return Response.json({ error: "تحديث مراحل التنفيذ متاح لحساب المصنع فقط" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = (await request.json()) as { stages?: unknown };
    if (!Array.isArray(payload.stages)) {
      return Response.json({ error: "قائمة المراحل غير صحيحة" }, { status: 400 });
    }
    const validKeys = WORK_STAGES.map(s => s.key) as readonly string[];
    if (!payload.stages.every(k => typeof k === "string" && validKeys.includes(k))) {
      return Response.json({ error: "مرحلة غير معروفة" }, { status: 400 });
    }
    const stages = parseStages(JSON.stringify(payload.stages));
    const value = stagesToPercent(stages);

    const db = getDb();
    const [existing] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!existing) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });
    if (!isFactoryVisible(existing.status)) {
      return Response.json({ error: "هذا المشروع غير معتمد بعد" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const [updated] = await db
      .update(projects)
      .set({ stages: JSON.stringify(stages), completionPercent: value, completionUpdatedAt: now, updatedAt: now })
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

    return Response.json({ project: { id: updated.id, stages: updated.stages, completionPercent: updated.completionPercent, completionUpdatedAt: updated.completionUpdatedAt } });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
