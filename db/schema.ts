import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// حسابات الدخول: كل حساب له اسم مستخدم وكلمة مرور ودور واحد فقط
// (engineer = المهندس/المكتب، factory = المصنع).
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  role: text("role").notNull(), // "engineer" | "factory"
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
// status يحل محل الحقل الثنائي القديم (approved) بست مراحل واضحة:
// draft -> review -> approved -> in_progress -> completed -> delivered
// (راجع app/lib/project-utils.ts لقائمة القيم المسموحة والتسميات العربية).
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("مشروع جديد"),
  clientName: text("client_name").notNull().default(""),
  data: text("data").notNull(), // JSON: { settings, pages }
  status: text("status").notNull().default("draft"),
  statusUpdatedAt: text("status_updated_at"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  completionPercent: integer("completion_percent").notNull().default(0),
  completionUpdatedAt: text("completion_updated_at"),
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
