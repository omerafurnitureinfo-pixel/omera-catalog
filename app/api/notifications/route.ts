import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { activityLog, projects } from "../../../db/schema";
import { getSessionUserFromRequest } from "../../lib/auth";
import { toRouteErrorMessage } from "../../lib/db-error";
import { isFactoryVisible } from "../../lib/project-utils";

const LIMIT = 40;

// إشعارات تعديل الكتالوج بعد الاعتماد. موجّهة للمصنع: المهندس هو من أجرى
// التعديل فلا معنى لإشعاره به. تُقصر على المشاريع الظاهرة للمصنع فعلًا.
export async function GET(request: Request) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me) return Response.json({ error: "الرجاء تسجيل الدخول" }, { status: 401 });
    if (me.role !== "factory") return Response.json({ notifications: [] });

    const db = getDb();
    const visible = await db.select().from(projects);
    const allowed = visible.filter((p) => isFactoryVisible(p.status));
    if (allowed.length === 0) return Response.json({ notifications: [] });

    const byId = new Map(allowed.map((p) => [p.id, p]));
    const rows = await db
      .select()
      .from(activityLog)
      .where(and(eq(activityLog.action, "page_edited"), inArray(activityLog.projectId, allowed.map((p) => p.id))))
      .orderBy(desc(activityLog.createdAt))
      .limit(LIMIT);

    const notifications = rows.map((row) => {
      let page: number | null = null;
      let text = row.details ?? "";
      try {
        const parsed = JSON.parse(row.details ?? "{}") as { page?: number | null; text?: string };
        page = parsed.page ?? null;
        text = parsed.text ?? text;
      } catch { /* سجل قديم بنص عادي */ }
      const project = byId.get(row.projectId);
      return {
        id: row.id,
        projectId: row.projectId,
        projectName: project?.name ?? "",
        clientName: project?.clientName ?? "",
        clientNumber: project?.clientNumber ?? null,
        page,
        text,
        by: row.userDisplayName,
        createdAt: row.createdAt,
      };
    });

    return Response.json({ notifications });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
