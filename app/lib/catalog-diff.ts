// مقارنة نسختين من الكتالوج لإنتاج وصف عربي مقروء لكل تغيير، مع رقم الصفحة.
// تُستخدم على الخادم عند حفظ المهندس لمشروع معتمد، فيصل للمصنع إشعار يذكر
// ماذا تغيّر بالضبط وفي أي صفحة.

type Row = { id: string; label: string; value: string; visible: boolean; image?: string };
type Sample = { id: string; name: string; supplier: string; code: string; color: string; use: string; quantity: string; notes?: string; image?: string; swatch?: string };
type Page = {
  id: string; kind: string; title: string; hidden?: boolean; image?: string;
  fields?: Record<string, string>; rows?: Row[]; samples?: Sample[];
};
type Data = { pages?: Page[] };

// مفتاح ثابت لكل تغيير حتى نجمع تعديلات نفس الخانة في إشعار واحد بدل
// إشعار لكل ضغطة حفظ تلقائي.
// label/from/to تُحفظ لتغييرات النصوص حتى يمكن — عند تجميع تعديلات متتابعة
// على نفس الخانة — إعادة بناء الجملة من القيمة الأصلية إلى الأخيرة، لا من
// آخر حرفين كُتبا.
export type CatalogChange = {
  key: string; page: number | null; text: string;
  label?: string; from?: string; to?: string;
};

export const renderTextChange = (label: string, before: string, after: string) => changedText(label, before, after);

const MAX_CHANGES = 12;
const SNIPPET = 40;

const clip = (value: string) => {
  const flat = (value ?? "").replace(/\s+/g, " ").trim();
  if (!flat) return "";
  return flat.length > SNIPPET ? `${flat.slice(0, SNIPPET)}…` : flat;
};

// وصف تغيّر نص: يذكر القيمة القديمة والجديدة، أو الإضافة/الحذف.
const changedText = (label: string, before: string, after: string) => {
  const from = clip(before);
  const to = clip(after);
  if (!from && to) return `${label}: أُضيف «${to}»`;
  if (from && !to) return `${label}: حُذف «${from}»`;
  return `${label}: من «${from}» إلى «${to}»`;
};

const isImage = (value?: string) => Boolean(value && value.trim());
const imageWord = (label: string, before?: string, after?: string) => {
  if (!isImage(before) && isImage(after)) return `${label}: أُضيفت صورة`;
  if (isImage(before) && !isImage(after)) return `${label}: حُذفت الصورة`;
  return `${label}: استُبدلت الصورة`;
};

const FIELD_LABELS: Record<string, string> = {
  title: "العنوان",
  subtitle: "العنوان الفرعي",
  intro: "المقدمة",
  client: "اسم العميل",
  project: "اسم المشروع",
  location: "الموقع",
  date: "التاريخ",
  prepared: "أُعدّ بواسطة",
  body: "النص",
  notes: "الملاحظات",
  code: "الكود",
  quantity: "الكمية",
};
const fieldLabel = (key: string) => FIELD_LABELS[key] ?? key;

const SAMPLE_LABELS: Record<keyof Sample & string, string> = {
  id: "المعرّف", name: "اسم الخامة", supplier: "المورد", code: "الكود",
  color: "اللون", use: "الاستخدام", quantity: "الكمية", notes: "الملاحظات",
  image: "الصورة", swatch: "لون الرمز",
};

const parse = (raw: unknown): Data => {
  if (typeof raw === "string") { try { return JSON.parse(raw) as Data; } catch { return {}; } }
  return (raw ?? {}) as Data;
};

export function describeCatalogChanges(beforeRaw: unknown, afterRaw: unknown): CatalogChange[] {
  const before = parse(beforeRaw);
  const after = parse(afterRaw);
  const oldPages = Array.isArray(before.pages) ? before.pages : [];
  const newPages = Array.isArray(after.pages) ? after.pages : [];
  if (oldPages.length === 0 && newPages.length === 0) return [];

  const changes: CatalogChange[] = [];
  const push = (key: string, page: number | null, text: string) => {
    if (changes.length < MAX_CHANGES) changes.push({ key, page, text });
  };
  // تغيّر نصي: نحتفظ بالقيمتين لإعادة الصياغة عند التجميع.
  const pushText = (key: string, page: number | null, label: string, from: string, to: string) => {
    if (changes.length < MAX_CHANGES) changes.push({ key, page, text: changedText(label, from, to), label, from, to });
  };

  const oldById = new Map(oldPages.map((p) => [p.id, p]));
  const newById = new Map(newPages.map((p) => [p.id, p]));

  // صفحات محذوفة — رقمها من الترتيب القديم.
  oldPages.forEach((page, index) => {
    if (!newById.has(page.id)) {
      push(`page:${page.id}:removed`, index + 1, `حُذفت الصفحة رقم ${index + 1} (${page.title || "بلا عنوان"})`);
    }
  });

  newPages.forEach((page, index) => {
    const number = index + 1;
    const old = oldById.get(page.id);

    if (!old) {
      push(`page:${page.id}:added`, number, `أُضيفت صفحة جديدة رقم ${number} (${page.title || "بلا عنوان"})`);
      return;
    }

    const oldIndex = oldPages.findIndex((p) => p.id === page.id);
    if (oldIndex !== -1 && oldIndex !== index) {
      push(`page:${page.id}:moved`, number, `نُقلت الصفحة «${page.title || "بلا عنوان"}» من رقم ${oldIndex + 1} إلى رقم ${number}`);
    }

    if ((old.title ?? "") !== (page.title ?? "")) {
      pushText(`page:${page.id}:title`, number, "اسم الصفحة", old.title ?? "", page.title ?? "");
    }
    if (Boolean(old.hidden) !== Boolean(page.hidden)) {
      push(`page:${page.id}:hidden`, number, page.hidden ? "أُخفيت الصفحة من التصدير" : "أُعيد إظهار الصفحة في التصدير");
    }
    if ((old.image ?? "") !== (page.image ?? "")) {
      push(`page:${page.id}:image`, number, imageWord("صورة الصفحة", old.image, page.image));
    }

    // الخانات العامة للصفحة
    const fieldKeys = new Set([...Object.keys(old.fields ?? {}), ...Object.keys(page.fields ?? {})]);
    for (const key of fieldKeys) {
      const a = old.fields?.[key] ?? "";
      const b = page.fields?.[key] ?? "";
      if (a !== b) pushText(`page:${page.id}:field:${key}`, number, fieldLabel(key), a, b);
    }

    // صفوف المواصفات (الوصف/الأبعاد/الدهان/القماش/بريم...)
    const oldRows = new Map((old.rows ?? []).map((r) => [r.id, r]));
    const newRows = new Map((page.rows ?? []).map((r) => [r.id, r]));
    for (const [rowId, row] of oldRows) {
      if (!newRows.has(rowId)) push(`page:${page.id}:row:${rowId}:removed`, number, `حُذف السطر «${row.label || "بلا اسم"}»`);
    }
    for (const [rowId, row] of newRows) {
      const oldRow = oldRows.get(rowId);
      if (!oldRow) {
        push(`page:${page.id}:row:${rowId}:added`, number, `أُضيف سطر «${row.label || "بلا اسم"}»${clip(row.value) ? `: ${clip(row.value)}` : ""}`);
        continue;
      }
      if ((oldRow.label ?? "") !== (row.label ?? "")) {
        pushText(`page:${page.id}:row:${rowId}:label`, number, "اسم السطر", oldRow.label ?? "", row.label ?? "");
      }
      if ((oldRow.value ?? "") !== (row.value ?? "")) {
        pushText(`page:${page.id}:row:${rowId}:value`, number, row.label || "سطر", oldRow.value ?? "", row.value ?? "");
      }
      if ((oldRow.image ?? "") !== (row.image ?? "")) {
        push(`page:${page.id}:row:${rowId}:image`, number, imageWord(row.label || "سطر", oldRow.image, row.image));
      }
      if (Boolean(oldRow.visible) !== Boolean(row.visible)) {
        push(`page:${page.id}:row:${rowId}:visible`, number, `${row.visible ? "أُظهر" : "أُخفي"} السطر «${row.label || "بلا اسم"}»`);
      }
    }

    // عيّنات الخامات والأقمشة
    const oldSamples = new Map((old.samples ?? []).map((s) => [s.id, s]));
    const newSamples = new Map((page.samples ?? []).map((s) => [s.id, s]));
    for (const [sampleId, sample] of oldSamples) {
      if (!newSamples.has(sampleId)) push(`page:${page.id}:sample:${sampleId}:removed`, number, `حُذفت الخامة «${sample.name || sample.code || "بلا اسم"}»`);
    }
    for (const [sampleId, sample] of newSamples) {
      const oldSample = oldSamples.get(sampleId);
      const who = sample.name || sample.code || "خامة";
      if (!oldSample) {
        push(`page:${page.id}:sample:${sampleId}:added`, number, `أُضيفت خامة «${who}»`);
        continue;
      }
      for (const key of ["name", "supplier", "code", "color", "use", "quantity", "notes"] as const) {
        const a = (oldSample[key] ?? "") as string;
        const b = (sample[key] ?? "") as string;
        if (a !== b) pushText(`page:${page.id}:sample:${sampleId}:${key}`, number, `${who} — ${SAMPLE_LABELS[key]}`, a, b);
      }
      if ((oldSample.image ?? "") !== (sample.image ?? "")) {
        push(`page:${page.id}:sample:${sampleId}:image`, number, imageWord(`${who} — الصورة`, oldSample.image, sample.image));
      }
    }
  });

  return changes;
}

// نص الإشعار الذي يراه المصنع.
export function changeNotificationText(change: CatalogChange): string {
  return change.page === null ? change.text : `تم تعديل معلومات صفحة رقم ${change.page} — ${change.text}`;
}
