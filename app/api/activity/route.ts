import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { activityLog, projects } from "../../../db/schema";
import { getSessionUserFromRequest } from "../../lib/auth";
import { toRouteErrorMessage } from "../../lib/db-error";

// تغذية "تحديثات المصنع" في لوحة التحكم — تحديثات نسبة الإنجاز عبر كل
// المشاريع في مكان واحد، للمهندس فقط. المصنع نفسه لا يحتاج هذه الشاشة
// (لديه بوابته الخاصة).
export async function GET(request: Request) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me || me.role !== "engineer") {
      return Response.json({ error: "متاح لحساب المهندس فقط" }, { status: 403 });
    }

    const db = getDb();
    const rows = await db
      .select({
        id: activityLog.id,
        projectId: activityLog.projectId,
        projectName: projects.name,
        userDisplayName: activityLog.userDisplayName,
        details: activityLog.details,
        createdAt: activityLog.createdAt,
      })
      .from(activityLog)
      .innerJoin(projects, eq(activityLog.projectId, projects.id))
      .where(eq(activityLog.action, "progress_updated"))
      .orderBy(desc(activityLog.createdAt))
      .limit(30);

    return Response.json({ updates: rows });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
