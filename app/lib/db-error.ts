export function toRouteErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "خطأ غير متوقع";
  const detail = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  const combined = `${message}\n${detail}`;

  if (combined.includes("D1 binding") || combined.includes("`DB`")) {
    return "قاعدة البيانات غير مُفعّلة بعد لهذا الموقع. فعّل ربط Cloudflare D1 باسم DB من إعدادات الاستضافة (.openai/hosting.json) ثم شغّل npm run db:generate وأعد النشر.";
  }
  if (combined.includes("no such table")) {
    return "جداول قاعدة البيانات غير موجودة بعد. شغّل npm run db:generate ثم أعد النشر ليتم إنشاء الجداول.";
  }
  if (combined.includes("UNIQUE constraint failed")) {
    return "اسم المستخدم هذا مستخدم مسبقًا.";
  }
  return message;
}
