import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { projects } from "../../../../../db/schema";
import { logActivity } from "../../../../lib/activity";
import { getSessionUserFromRequest } from "../../../../lib/auth";
import { toRouteErrorMessage } from "../../../../lib/db-error";
import { isProjectStatus, STATUS_LABELS } from "../../../../lib/project-utils";

// المهندس فقط يملك صلاحية تغيير مرحلة المشروع (اعتماد أو تراجع) في أي وقت.
// عند الرجوع لمرحلة قبل "معتمد"، يختفي المشروع فورًا من شاشة المصنع
// (يُفلتر في GET /api/projects) لكن كل بيانات التنفيذ (التواريخ ونسبة
// الإنجاز) تبقى محفوظة ليمكن استكمالها عند إعادة الاعتماد.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me || me.role !== "engineer") {
      return Response.json({ error: "تغيير مرحلة المشروع متاح لحساب المهندس فقط" }, { status: 403 });
    }
    const { id } = await context.params;
    const payload = (await request.json()) as { status: string; startDate?: string | null; dueDate?: string | null };
    if (!isProjectStatus(payload.status)) {
      return Response.json({ error: "مرحلة غير معروفة" }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!existing) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now, status: payload.status, statusUpdatedAt: now };
    if (payload.startDate !== undefined) updates.startDate = payload.startDate || null;
    if (payload.dueDate !== undefined) updates.dueDate = payload.dueDate || null;

    const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();
    if (!updated) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });

    if (existing.status !== updated.status) {
      await logActivity({
        projectId: id,
        userId: me.id,
        userDisplayName: me.displayName || me.username,
        action: "status_changed",
        details: `من "${STATUS_LABELS[existing.status as keyof typeof STATUS_LABELS] ?? existing.status}" إلى "${STATUS_LABELS[updated.status as keyof typeof STATUS_LABELS] ?? updated.status}"`,
      });
    }

    return Response.json({
      project: {
        id: updated.id,
        status: updated.status,
        statusUpdatedAt: updated.statusUpdatedAt,
        startDate: updated.startDate,
        dueDate: updated.dueDate,
      },
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
