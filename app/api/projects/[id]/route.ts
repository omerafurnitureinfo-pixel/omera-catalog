import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { projects } from "../../../../db/schema";
import { getSessionUserFromRequest } from "../../../lib/auth";
import { toRouteErrorMessage } from "../../../lib/db-error";
import { extractClientName, isFactoryVisible } from "../../../lib/project-utils";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me) return Response.json({ error: "الرجاء تسجيل الدخول" }, { status: 401 });

    const { id } = await context.params;
    const db = getDb();
    const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!row) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });
    if (me.role === "factory" && !isFactoryVisible(row.status)) {
      return Response.json({ error: "هذا المشروع غير معتمد بعد" }, { status: 403 });
    }

    return Response.json({
      project: {
        id: row.id,
        name: row.name,
        clientName: row.clientName,
        clientNumber: row.clientNumber,
        data: JSON.parse(row.data),
        status: row.status,
        statusUpdatedAt: row.statusUpdatedAt,
        startDate: row.startDate,
        dueDate: row.dueDate,
        completionPercent: row.completionPercent,
        completionUpdatedAt: row.completionUpdatedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me || me.role !== "engineer") {
      return Response.json({ error: "تعديل المشروع متاح لحساب المهندس فقط" }, { status: 403 });
    }
    const { id } = await context.params;
    const payload = (await request.json()) as { name?: string; data?: unknown };
    const db = getDb();
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = { updatedAt: now };
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.data !== undefined) {
      const serialized = JSON.stringify(payload.data);
      // مشروع كبير جدًا (غالبًا صور غير مضغوطة) يتجاوز حد وقت معالجة
      // Cloudflare Workers أثناء الحفظ فيفشل الطلب بلا رسالة واضحة. نرفض
      // مبكرًا برسالة يفهمها المستخدم بدل انهيار الطلب لاحقًا بصمت.
      const MAX_PROJECT_BYTES = 2_500_000;
      if (serialized.length > MAX_PROJECT_BYTES) {
        return Response.json({ error: "حجم المشروع كبير جدًا للحفظ (على الأغلب بسبب صور كبيرة). قلّل حجم بعض الصور أو احذف صورًا غير ضرورية ثم حاول الحفظ مجددًا." }, { status: 413 });
      }
      updates.data = serialized;
      updates.clientName = extractClientName(payload.data);
    }

    const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning();
    if (!updated) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });
    return Response.json({ project: { id: updated.id, name: updated.name, clientName: updated.clientName, updatedAt: updated.updatedAt } });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me || me.role !== "engineer") {
      return Response.json({ error: "حذف المشروع متاح لحساب المهندس فقط" }, { status: 403 });
    }
    const { id } = await context.params;
    const db = getDb();
    await db.delete(projects).where(eq(projects.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
