import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { projects } from "../../../../../db/schema";
import { logActivity } from "../../../../lib/activity";
import { getSessionUserFromRequest } from "../../../../lib/auth";
import { toRouteErrorMessage } from "../../../../lib/db-error";
import { ENGINEER_STATUSES, FACTORY_STATUSES, isProjectStatus, STATUS_LABELS } from "../../../../lib/project-utils";

// تقسيم الصلاحيات:
// - المهندس: يعتمد الملف أو يتراجع عن الاعتماد فقط (review <-> approved).
//   وعند الاعتماد يُسجَّل تاريخ البداية تلقائيًا بتاريخ اليوم على الخادم.
// - المصنع: يحرّك مراحل التنفيذ (معتمد/تحت التنفيذ/مكتمل/تم التسليم)
//   ويحدّد تاريخ التسليم المتوقع.
// عند رجوع المهندس لمرحلة "قيد المراجعة" يختفي المشروع فورًا من شاشة المصنع
// (يُفلتر في GET /api/projects) لكن كل بيانات التنفيذ تبقى محفوظة.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me) return Response.json({ error: "الرجاء تسجيل الدخول" }, { status: 401 });

    const { id } = await context.params;
    const payload = (await request.json()) as { status: string; dueDate?: string | null };
    if (!isProjectStatus(payload.status)) {
      return Response.json({ error: "مرحلة غير معروفة" }, { status: 400 });
    }

    const isEngineer = me.role === "engineer";
    const allowed = isEngineer ? ENGINEER_STATUSES : FACTORY_STATUSES;
    if (!allowed.includes(payload.status)) {
      return Response.json({
        error: isEngineer
          ? "حساب المهندس يعتمد المشروع أو يتراجع عن الاعتماد فقط — مراحل التنفيذ يحدّدها المصنع."
          : "حساب المصنع يحدّد مراحل التنفيذ فقط — الاعتماد والتراجع عنه من صلاحية المهندس.",
      }, { status: 403 });
    }
    if (isEngineer && payload.dueDate !== undefined) {
      return Response.json({ error: "تاريخ التسليم المتوقع يحدّده المصنع." }, { status: 403 });
    }

    const db = getDb();
    const [existing] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!existing) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now, status: payload.status, statusUpdatedAt: now };
    // اعتماد المهندس = تسليم الملف للمصنع، فيُسجَّل تاريخ اليوم تلقائيًا.
    if (isEngineer && payload.status === "approved") {
      updates.startDate = now.slice(0, 10);
    }
    if (!isEngineer && payload.dueDate !== undefined) updates.dueDate = payload.dueDate || null;

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
