type LooseProjectData = {
  pages?: Array<{ kind?: string; fields?: Record<string, string> }>;
};

// اسم العميل يُشتق دائمًا من خانة "اسم العميل" في صفحة الغلاف (fields.client)
// بحيث تبقى الخانتان مرتبطتين تلقائيًا في الاتجاهين، بلا حاجة لإدخال منفصل.
export function extractClientName(data: unknown): string {
  const d = data as LooseProjectData;
  const cover = d?.pages?.find((p) => p.kind === "cover");
  return (cover?.fields?.client ?? "").trim();
}

/* ---------------- مراحل المشروع ---------------- */
// ملف مشترك بين الواجهة (editor/factory) والـ API، لذا يبقى بلا أي استيراد
// خاص بالخادم (لا getDb هنا) حتى يصلح استخدامه داخل مكوّنات "use client".

// "draft" أُبقي هنا فقط للتوافق مع مشاريع قديمة أُنشئت قبل حذف هذه المرحلة
// من الواجهة — لم تعد تُعرض كخيار في شريط المراحل (انظر STEPPER_STATUSES)
// ولا تُستخدم كحالة ابتدائية لمشروع جديد (المشاريع الجديدة تبدأ من "review").
export const PROJECT_STATUSES = ["draft", "review", "approved", "in_progress", "completed", "delivered"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// المراحل المعروضة فعليًا في شريط "مرحلة المشروع" بالواجهة.
export const STEPPER_STATUSES = ["review", "approved", "in_progress", "completed", "delivered"] as const;

// تقسيم الصلاحيات: المهندس يعتمد الملف فقط (أو يتراجع عن الاعتماد)، بينما
// المصنع هو من يحرّك مراحل التنفيذ ويحدد تاريخ التسليم المتوقع.
export const ENGINEER_STATUSES: ProjectStatus[] = ["review", "approved"];
export const FACTORY_STATUSES: ProjectStatus[] = ["approved", "in_progress", "completed", "delivered"];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "مسودة",
  review: "قيد المراجعة",
  approved: "معتمد",
  in_progress: "تحت التنفيذ",
  completed: "مكتمل",
  delivered: "تم التسليم",
};

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

// شكل مشترك لملخص المشروع كما تعيده مسارات /api/projects — يُستخدم في
// محرر المهندس، لوحة التحكم، وبوابة المصنع لتفادي تكرار النوع وانحرافه.
export type ProjectSummary = {
  id: string;
  name: string;
  clientName: string;
  clientNumber: number | null;
  status: ProjectStatus;
  statusUpdatedAt: string | null;
  startDate: string | null;
  dueDate: string | null;
  stages: string;
  completionPercent: number;
  completionUpdatedAt: string | null;
  totalAmount: number | null;
  paidAmount: number | null;
  paymentUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/* ---------------- مراحل التنفيذ عند المصنع ---------------- */

// أربع مراحل يؤشّرها المصنع، كل واحدة تساوي 25% من نسبة الإنجاز.
export const WORK_STAGES = [
  { key: "carpentry", label: "توريد النجارة" },
  { key: "paint", label: "توريد الدهان" },
  { key: "upholstery", label: "توريد التنجيد" },
  { key: "installation", label: "التركيب" },
] as const;

export type WorkStageKey = (typeof WORK_STAGES)[number]["key"];
const STAGE_KEYS = WORK_STAGES.map(s => s.key) as readonly string[];
export const STAGE_PERCENT = 100 / WORK_STAGES.length;

// نقرأ المراحل بتساهل (قد تأتي من قاعدة بيانات قديمة أو JSON تالف) ونتجاهل
// أي مفتاح غير معروف أو مكرر حتى لا تتجاوز النسبة 100%.
export function parseStages(raw: string | null | undefined): WorkStageKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((k): k is WorkStageKey => typeof k === "string" && STAGE_KEYS.includes(k)))];
  } catch {
    return [];
  }
}

export const stagesToPercent = (stages: readonly string[]) =>
  Math.round(stages.length * STAGE_PERCENT);

/* ---------------- السداد وتنبيهات المطالبة ---------------- */

// نسبة السداد محسوبة دائمًا من المبلغين (لا تُخزَّن) حتى لا تتعارض القيم.
export function paymentPercent(p: { totalAmount: number | null; paidAmount: number | null }): number | null {
  if (!p.totalAmount || p.totalAmount <= 0) return null;
  const paid = p.paidAmount ?? 0;
  return Math.max(0, Math.min(100, Math.round((paid / p.totalAmount) * 100)));
}

export function remainingAmount(p: { totalAmount: number | null; paidAmount: number | null }): number | null {
  if (p.totalAmount == null) return null;
  return Math.max(0, p.totalAmount - (p.paidAmount ?? 0));
}

export const formatAmount = (value: number | null) =>
  value == null ? "—" : `${value.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;

// عتبات مطالبة العميل: عند بلوغ نسبة الإنجاز من المصنع هذه النسب يُنبَّه
// المحاسب لمطالبة العميل بباقي المبلغ. 95% هو التحذير الأخير.
export const PAYMENT_ALERT_THRESHOLDS = [75, 90, 95] as const;
export type PaymentAlert = { threshold: number; level: "info" | "warn" | "final"; text: string };

// التنبيه يظهر فقط إذا لم يكتمل السداد بعد — اكتمال السداد يُلغي المطالبة.
export function paymentAlertFor(p: { completionPercent: number; totalAmount: number | null; paidAmount: number | null }): PaymentAlert | null {
  const paidPct = paymentPercent(p);
  if (paidPct !== null && paidPct >= 100) return null;
  const reached = PAYMENT_ALERT_THRESHOLDS.filter(t => p.completionPercent >= t).pop();
  if (!reached) return null;
  if (reached === 95) return { threshold: 95, level: "final", text: "تحذير أخير: الإنجاز بلغ 95% — يجب تحصيل باقي المبلغ قبل التسليم." };
  if (reached === 90) return { threshold: 90, level: "warn", text: "الإنجاز بلغ 90% — طالب العميل بباقي المبلغ." };
  return { threshold: 75, level: "info", text: "الإنجاز بلغ 75% — ابدأ مطالبة العميل بباقي المبلغ." };
}

// المراحل التي يظهر عندها المشروع لقسم المصنع (من الاعتماد فصاعدًا).
const FACTORY_VISIBLE_STATUSES: ProjectStatus[] = ["approved", "in_progress", "completed", "delivered"];
export function isFactoryVisible(status: string): boolean {
  return FACTORY_VISIBLE_STATUSES.includes(status as ProjectStatus);
}

// تصنيف المراحل الست إلى 3 مجموعات لعرضها في لوحة التحكم الرئيسية.
export type DashboardGroup = "pending" | "active" | "delivered";
export const DASHBOARD_GROUP_LABELS: Record<DashboardGroup, string> = {
  pending: "المشاريع تحت الاعتماد",
  active: "المشاريع المعتمدة",
  delivered: "المشاريع المستلمة",
};
export function dashboardGroupOf(status: string): DashboardGroup {
  if (status === "draft" || status === "review") return "pending";
  if (status === "completed" || status === "delivered") return "delivered";
  return "active"; // approved | in_progress
}

export type DueTone = "ok" | "warn" | "late" | "none";
export function dueDateInfo(dueDate: string | null | undefined): { text: string; tone: DueTone; diffDays: number | null } {
  if (!dueDate) return { text: "بلا تاريخ تسليم محدد", tone: "none", diffDays: null };
  const due = new Date(dueDate).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: `متأخر ${Math.abs(diffDays)} يوم`, tone: "late", diffDays };
  if (diffDays === 0) return { text: "التسليم اليوم", tone: "warn", diffDays };
  if (diffDays <= 3) return { text: `متبقي ${diffDays} أيام`, tone: "warn", diffDays };
  return { text: `متبقي ${diffDays} يومًا`, tone: "ok", diffDays };
}
