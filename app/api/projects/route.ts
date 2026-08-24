import { desc, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { projects } from "../../../db/schema";
import { logActivity } from "../../lib/activity";
import { getSessionUserFromRequest } from "../../lib/auth";
import { toRouteErrorMessage } from "../../lib/db-error";
import { extractClientName } from "../../lib/project-utils";

const FACTORY_VISIBLE_DB_STATUSES = ["approved", "in_progress", "completed", "delivered"] as const;
const FIRST_CLIENT_NUMBER = 11001;

function summarize(row: typeof projects.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    clientName: row.clientName,
    clientNumber: row.clientNumber,
    status: row.status,
    statusUpdatedAt: row.statusUpdatedAt,
    startDate: row.startDate,
    dueDate: row.dueDate,
    completionPercent: row.completionPercent,
    completionUpdatedAt: row.completionUpdatedAt,
    totalAmount: row.totalAmount,
    paidAmount: row.paidAmount,
    paymentUpdatedAt: row.paymentUpdatedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// المهندس يرى كل المشاريع. المصنع والمحاسب يريان المشاريع من مرحلة
// "معتمد" فصاعدًا فقط.
export async function GET(request: Request) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me) return Response.json({ error: "الرجاء تسجيل الدخول" }, { status: 401 });

    const db = getDb();
    const rows =
      me.role === "engineer"
        ? await db.select().from(projects).orderBy(desc(projects.updatedAt))
        : await db.select().from(projects).where(inArray(projects.status, [...FACTORY_VISIBLE_DB_STATUSES])).orderBy(desc(projects.updatedAt));

    return Response.json({ projects: rows.map(summarize) });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me || me.role !== "engineer") {
      return Response.json({ error: "إنشاء المشاريع متاح لحساب المهندس فقط" }, { status: 403 });
    }
    const payload = (await request.json()) as { id: string; name: string; clientName?: string; data: unknown };
    if (!payload.id || !payload.name || payload.data === undefined) {
      return Response.json({ error: "بيانات المشروع ناقصة" }, { status: 400 });
    }
    const db = getDb();
    const now = new Date().toISOString();
    const [{ maxNumber }] = await db.select({ maxNumber: sql<number | null>`max(${projects.clientNumber})` }).from(projects);
    const nextClientNumber = (maxNumber ?? FIRST_CLIENT_NUMBER - 1) + 1;
    const [created] = await db
      .insert(projects)
      .values({
        id: payload.id,
        name: payload.name,
        clientName: extractClientName(payload.data),
        clientNumber: nextClientNumber,
        data: JSON.stringify(payload.data),
        status: "review",
        createdBy: me.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    await logActivity({ projectId: created.id, userId: me.id, userDisplayName: me.displayName || me.username, action: "created" });
    return Response.json({ project: summarize(created) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
