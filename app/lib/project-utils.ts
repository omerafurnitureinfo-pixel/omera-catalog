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

export const PROJECT_STATUSES = ["draft", "review", "approved", "in_progress", "completed", "delivered"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

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
  completionPercent: number;
  completionUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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
