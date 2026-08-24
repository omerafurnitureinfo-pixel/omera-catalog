import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { projects } from "../../../../../db/schema";
import { logActivity } from "../../../../lib/activity";
import { getSessionUserFromRequest } from "../../../../lib/auth";
import { toRouteErrorMessage } from "../../../../lib/db-error";
import { formatAmount, isFactoryVisible, paymentPercent } from "../../../../lib/project-utils";

// بيانات السداد (إجمالي العقد والمبلغ المدفوع) من صلاحية المحاسب وحده.
// نسبة السداد تُحسب من المبلغين ولا تُخزَّن.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me) return Response.json({ error: "الرجاء تسجيل الدخول" }, { status: 401 });
    if (me.role !== "accountant") {
      return Response.json({ error: "تسجيل السداد متاح لحساب المحاسب فقط" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = (await request.json()) as { totalAmount?: number | string | null; paidAmount?: number | string | null };

    const parseAmount = (value: number | string | null | undefined) => {
      if (value === null || value === undefined || value === "") return { ok: true as const, value: null };
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) return { ok: false as const, value: null };
      return { ok: true as const, value: parsed };
    };

    const total = parseAmount(payload.totalAmount);
    const paid = parseAmount(payload.paidAmount);
    if (!total.ok || !paid.ok) {
      return Response.json({ error: "المبالغ يجب أن تكون أرقامًا غير سالبة" }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
    if (!existing) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });
    if (!isFactoryVisible(existing.status)) {
      return Response.json({ error: "هذا المشروع غير معتمد بعد" }, { status: 403 });
    }

    const nextTotal = payload.totalAmount !== undefined ? total.value : existing.totalAmount;
    const nextPaid = payload.paidAmount !== undefined ? paid.value : existing.paidAmount;
    if (nextTotal !== null && nextPaid !== null && nextPaid > nextTotal) {
      return Response.json({ error: "المبلغ المدفوع لا يمكن أن يتجاوز إجمالي العقد" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const [updated] = await db
      .update(projects)
      .set({ totalAmount: nextTotal, paidAmount: nextPaid, paymentUpdatedAt: now, updatedAt: now })
      .where(eq(projects.id, id))
      .returning();

    const before = paymentPercent(existing);
    const after = paymentPercent(updated);
    if (before !== after || existing.totalAmount !== updated.totalAmount) {
      await logActivity({
        projectId: id,
        userId: me.id,
        userDisplayName: me.displayName || me.username,
        action: "payment_updated",
        details: after === null ? formatAmount(updated.paidAmount) : `${after}%`,
      });
    }

    return Response.json({
      project: {
        id: updated.id,
        totalAmount: updated.totalAmount,
        paidAmount: updated.paidAmount,
        paymentUpdatedAt: updated.paymentUpdatedAt,
      },
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
