import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { projects } from "../../../../../db/schema";
import { getSessionUserFromRequest } from "../../../../lib/auth";
import { toRouteErrorMessage } from "../../../../lib/db-error";
import { MATERIAL_STAGES, isFactoryVisible, parseMaterials } from "../../../../lib/project-utils";

// جدول توريد الخامات: أداة داخلية للمصنع فقط. لا يمسّ نسبة الإنجاز ولا
// يُسجَّل في سجل النشاط، لأنه لا يخصّ المهندس ولا المحاسب.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me) return Response.json({ error: "الرجاء تسجيل الدخول" }, { status: 401 });
    if (me.role !== "factory") {
      return Response.json({ error: "جدول توريد الخامات متاح لحساب المصنع فقط" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = (await request.json()) as {
      materials?: unknown;
      factoryDueDate?: string | null;
      factoryNote?: string | null;
    };

    const updates: Record<string, unknown> = {};

    if (payload.materials !== undefined) {
      if (!Array.isArray(payload.materials)) {
        return Response.json({ error: "قائمة الخامات غير صحيحة" }, { status: 400 });
      }
      const validKeys = MATERIAL_STAGES.map(s => s.key) as readonly string[];
      if (!payload.materials.every(k => typeof k === "string" && validKeys.includes(k))) {
        return Response.json({ error: "عنصر خامات غير معروف" }, { status: 400 });
      }
      updates.materials = JSON.stringify(parseMaterials(JSON.stringify(payload.materials)));
    }
    // فارغ = غير مُدخَل، فيُخزَّن null ولا يظهر للمهندس.
    if (payload.factoryDueDate !== undefined) {
      updates.factoryDueDate = payload.factoryDueDate?.trim() ? payload.factoryDueDate : null;
    }
    if (payload.factoryNote !== undefined) {
      updates.factoryNote = payload.factoryNote?.trim() ? payload.factoryNote.trim() : null;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "لا توجد بيانات للحفظ" }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!existing) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });
    if (!isFactoryVisible(existing.status)) {
      return Response.json({ error: "هذا المشروع غير معتمد بعد" }, { status: 403 });
    }

    const now = new Date().toISOString();
    const [updated] = await db
      .update(projects)
      .set({ ...updates, updatedAt: now })
      .where(eq(projects.id, id))
      .returning();

    return Response.json({
      project: {
        id: updated.id,
        materials: updated.materials,
        factoryDueDate: updated.factoryDueDate,
        factoryNote: updated.factoryNote,
      },
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
