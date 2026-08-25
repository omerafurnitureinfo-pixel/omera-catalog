import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

// حسابات الدخول: كل حساب له اسم مستخدم وكلمة مرور ودور واحد فقط
// (engineer = المهندس/المكتب، factory = المصنع، accountant = المحاسب).
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  role: text("role").notNull(), // "engineer" | "factory" | "accountant"
  displayName: text("display_name").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// جلسات الدخول (كوكيز الجلسة) — تُخزَّن في القاعدة حتى يمكن تسجيل الخروج
// أو إلغاء جلسة معيّنة من السيرفر مباشرة.
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// المشاريع (الكتالوجات). محتوى الصفحات نفسه يُخزَّن كـ JSON في العمود data
// حفاظًا على نفس بنية البيانات المستخدمة في المحرر، بينما تُستخرج بيانات
// الاعتماد والتنفيذ إلى أعمدة مستقلة لتسهيل الفلترة والاستعلام لشاشة المصنع.
//
// status يحل محل الحقل الثنائي القديم (approved) بمراحل واضحة:
// review -> approved -> in_progress -> completed -> delivered
// ("draft" أُبقيت في القيم المسموحة للتوافق مع مشاريع قديمة فقط، ولم تعد
// تُستخدم كحالة ابتدائية ولا تظهر في شريط المراحل — راجع
// app/lib/project-utils.ts لقائمة القيم والتسميات العربية).
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("مشروع جديد"),
  clientName: text("client_name").notNull().default(""),
  clientNumber: integer("client_number"), // رقم تسلسلي يبدأ من 11001، يُحسب عند إنشاء المشروع
  data: text("data").notNull(), // JSON: { settings, pages }
  status: text("status").notNull().default("review"),
  statusUpdatedAt: text("status_updated_at"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  // مراحل التنفيذ الأربع التي يؤشّرها المصنع (JSON array من مفاتيح المراحل).
  // نسبة الإنجاز تُشتق منها: كل مرحلة = 25%.
  stages: text("stages").notNull().default("[]"),
  // جدول توريد الخامات — لمساعدة المصنع فقط، خارج نسبة الإنجاز.
  materials: text("materials").notNull().default("[]"),
  // تاريخ تسليم متوقع من المصنع + ملاحظته. اختياريان: لا يظهران للمهندس
  // إلا إذا عبّأهما المصنع فعلًا.
  factoryDueDate: text("factory_due_date"),
  factoryNote: text("factory_note"),
  completionPercent: integer("completion_percent").notNull().default(0),
  completionUpdatedAt: text("completion_updated_at"),
  // بيانات السداد — يحدّدها المحاسب وحده. نسبة السداد تُحسب من المبلغين
  // ولا تُخزَّن حتى لا تتعارض القيمتان.
  totalAmount: real("total_amount"),
  paidAmount: real("paid_amount"),
  paymentUpdatedAt: text("payment_updated_at"),
  createdBy: integer("created_by"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// سجل النشاط: يوثّق كل تغيير مهم على المشروع (تغيير المرحلة/الاعتماد،
// تحديث نسبة الإنجاز، إنشاء المشروع) مع اسم صاحب الإجراء ووقته.
// userDisplayName يُخزَّن كنسخة ثابتة وقت الحدث حتى يبقى السجل مفهومًا
// حتى لو حُذف الحساب لاحقًا.
export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: text("project_id").notNull(),
  userId: integer("user_id"),
  userDisplayName: text("user_display_name").notNull().default(""),
  action: text("action").notNull(), // "created" | "status_changed" | "progress_updated"
  details: text("details"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
