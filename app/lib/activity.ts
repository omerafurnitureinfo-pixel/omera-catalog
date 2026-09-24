import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../db";
import { activityLog } from "../../db/schema";
import { CatalogChange, renderTextChange } from "./catalog-diff";

export type ActivityAction = "created" | "status_changed" | "progress_updated" | "payment_updated" | "page_edited";

// نافذة تجميع تعديلات نفس الخانة. الحفظ التلقائي يعمل كل 600ms أثناء
// الكتابة، فبدون تجميع يصل للمصنع إشعار لكل ضغطة. داخل هذه النافذة
// نحدّث الإشعار القائم بالقيمة الأخيرة بدل إضافة إشعار جديد.
const COALESCE_MINUTES = 20;

// إشعارات تعديل الصفحات: صف واحد لكل خانة متغيّرة، يحمل مفتاحًا ثابتًا
// في changeKey حتى نتعرّف عليه ونحدّثه لاحقًا.
export async function logPageEdits(params: {
  projectId: string;
  userId: number | null;
  userDisplayName: string;
  changes: CatalogChange[];
}): Promise<void> {
  if (params.changes.length === 0) return;
  const db = getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - COALESCE_MINUTES * 60_000).toISOString();

  const recent = await db
    .select()
    .from(activityLog)
    .where(and(eq(activityLog.projectId, params.projectId), eq(activityLog.action, "page_edited"), gt(activityLog.createdAt, cutoff)));

  for (const change of params.changes) {
    const existing = recent.find((row) => {
      try { return (JSON.parse(row.details ?? "{}") as { key?: string }).key === change.key; } catch { return false; }
    });

    let payload = { key: change.key, page: change.page, text: change.text, label: change.label, from: change.from, to: change.to };
    if (existing) {
      // الحفظ التلقائي يقارن بآخر نسخة محفوظة، فالتعديل المتتابع على نفس
      // الخانة ينتج «من آخر حرفين». نثبّت القيمة الأصلية من الإشعار القائم
      // حتى يقرأ المصنع التغيير كاملًا: من القيمة القديمة إلى الأخيرة.
      try {
        const prev = JSON.parse(existing.details ?? "{}") as { from?: string; label?: string };
        if (prev.from !== undefined && change.from !== undefined && change.to !== undefined) {
          const label = change.label ?? prev.label ?? "";
          payload = { ...payload, from: prev.from, text: renderTextChange(label, prev.from, change.to) };
        }
      } catch { /* سجل قديم: نكتب الجديد كما هو */ }
    }

    const details = JSON.stringify(payload);
    if (existing) {
      await db.update(activityLog).set({ details, createdAt: now.toISOString() }).where(eq(activityLog.id, existing.id));
    } else {
      await db.insert(activityLog).values({
        projectId: params.projectId,
        userId: params.userId,
        userDisplayName: params.userDisplayName,
        action: "page_edited",
        details,
        createdAt: now.toISOString(),
      });
    }
  }
}

// يُستدعى من route handlers فقط (يستخدم getDb الخاص بالخادم).
export async function logActivity(params: {
  projectId: string;
  userId: number | null;
  userDisplayName: string;
  action: ActivityAction;
  details?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(activityLog).values({
    projectId: params.projectId,
    userId: params.userId,
    userDisplayName: params.userDisplayName,
    action: params.action,
    details: params.details ?? null,
    createdAt: new Date().toISOString(),
  });
}
