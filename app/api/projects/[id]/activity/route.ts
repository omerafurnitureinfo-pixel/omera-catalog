import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { activityLog, projects } from "../../../../../db/schema";
import { getSessionUserFromRequest } from "../../../../lib/auth";
import { toRouteErrorMessage } from "../../../../lib/db-error";
import { isFactoryVisible } from "../../../../lib/project-utils";

// سجل النشاط متاح للمهندس دائمًا، وللمصنع فقط طالما المشروع ظاهر له
// حاليًا (نفس شرط الوصول المستخدم في مسارات المشروع الأخرى).
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me) return Response.json({ error: "الرجاء تسجيل الدخول" }, { status: 401 });

    const { id } = await context.params;
    const db = getDb();
    const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!project) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });
    if (me.role === "factory" && !isFactoryVisible(project.status)) {
      return Response.json({ error: "هذا المشروع غير معتمد بعد" }, { status: 403 });
    }

    const rows = await db
      .select()
      .from(activityLog)
      .where(eq(activityLog.projectId, id))
      .orderBy(desc(activityLog.createdAt))
      .limit(100);

    return Response.json({
      activity: rows.map((row) => ({
        id: row.id,
        userDisplayName: row.userDisplayName,
        action: row.action,
        details: row.details,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
