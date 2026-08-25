"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ChevronUp, Factory, LogOut, Plus, Printer, Sparkles } from "lucide-react";
import { CatalogPage } from "../catalog-types";
import { CatalogPageView } from "../catalog-view";
import { NotificationsBell } from "../notifications";
import { FACTORY_STATUSES, MATERIAL_STAGES, ProjectStatus, ProjectSummary, STATUS_LABELS, WORK_STAGES, dueDateInfo, parseMaterials, parseStages, stagesToPercent } from "../lib/project-utils";

type SessionUser = { id: number; username: string; displayName: string; role: "engineer" | "factory" };
type ActivityEntry = { id: number; userDisplayName: string; action: string; details: string | null; createdAt: string };
type FullProject = ProjectSummary & { data: { settings: Record<string, string | boolean>; pages: CatalogPage[] } };

async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "حدث خطأ غير متوقع");
  return data as T;
}

function activityLine(entry: ActivityEntry): string {
  const who = entry.userDisplayName || "النظام";
  if (entry.action === "created") return `${who} أنشأ المشروع`;
  if (entry.action === "status_changed") return `${who} غيّر المرحلة ${entry.details ?? ""}`;
  if (entry.action === "progress_updated") return `${who} حدّث نسبة الإنجاز إلى ${entry.details ?? ""}`;
  return `${who} — ${entry.action}`;
}

// خانة اختيارية: تاريخ تسليم متوقع من المصنع + ملاحظة. مخفية افتراضيًا،
// ويفتحها المصنع عند الحاجة. لا تظهر للمهندس إلا إذا عُبّئت فعلًا.
function FactoryNotePanel({ project, onSave }: {
  project: ProjectSummary;
  onSave: (project: ProjectSummary, factoryDueDate: string, factoryNote: string) => Promise<void>;
}) {
  const hasContent = Boolean(project.factoryDueDate || project.factoryNote);
  const [open, setOpen] = useState(hasContent);
  const [dueDate, setDueDate] = useState(project.factoryDueDate ?? "");
  const [note, setNote] = useState(project.factoryNote ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDueDate(project.factoryDueDate ?? ""); }, [project.factoryDueDate]);
  useEffect(() => { setNote(project.factoryNote ?? ""); }, [project.factoryNote]);

  const dirty = dueDate !== (project.factoryDueDate ?? "") || note !== (project.factoryNote ?? "");
  const save = async () => { setBusy(true); try { await onSave(project, dueDate, note); } finally { setBusy(false); } };

  if (!open) {
    return (
      <button className="outline-button factory-note-toggle" onClick={() => setOpen(true)}>
        <Plus size={14} /> إضافة تاريخ تسليم متوقع وملاحظة
      </button>
    );
  }

  return (
    <div className="factory-note-panel">
      <div className="factory-note-head">
        <span>تاريخ التسليم المتوقع وملاحظة المصنع</span>
        <button className="icon-button" title="إخفاء" onClick={() => setOpen(false)}><ChevronUp size={15} /></button>
      </div>
      <label className="field"><span>تاريخ التسليم المتوقع (من المصنع)</span>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      <label className="field"><span>ملاحظة</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="تظهر للمهندس عند كتابتها فقط" />
      </label>
      <button className="primary-button factory-note-save" disabled={busy || !dirty} onClick={save}>
        {busy ? "جارٍ الحفظ..." : "حفظ"}
      </button>
      {!hasContent && <small className="factory-note-hint">لن تظهر للمهندس ما دامت فارغة.</small>}
    </div>
  );
}

export default function FactoryClient({ user }: { user: SessionUser }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openProject, setOpenProject] = useState<FullProject | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api<{ projects: ProjectSummary[] }>("/api/projects")
      .then((d) => setProjects(d.projects))
      .catch((e) => setError(e instanceof Error ? e.message : "تعذر تحميل المشاريع"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    const onHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      navigator.sendBeacon("/api/auth/logout");
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const openDetails = async (id: string) => {
    try {
      const data = await api<{ project: FullProject }>(`/api/projects/${id}`);
      setOpenProject(data.project);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر فتح المشروع");
    }
  };

  // جدول الخامات للمصنع فقط ولا يمسّ نسبة الإنجاز.
  const toggleMaterial = async (project: ProjectSummary, key: string, checked: boolean) => {
    const current = parseMaterials(project.materials);
    const next = checked ? [...current, key] : current.filter(k => k !== key);
    const optimistic = { materials: JSON.stringify(next) };
    setProjects(list => list.map(p => (p.id === project.id ? { ...p, ...optimistic } : p)));
    if (openProject?.id === project.id) setOpenProject(p => (p ? { ...p, ...optimistic } : p));
    setError("");
    try {
      await api(`/api/projects/${project.id}/materials`, { method: "POST", body: JSON.stringify({ materials: next }) });
    } catch (e) {
      setError(e instanceof Error && e.message ? `تعذر حفظ توريد الخامات: ${e.message}` : "تعذر حفظ توريد الخامات، حاول مجددًا");
      load();
    }
  };

  // تاريخ التسليم المتوقع من المصنع وملاحظته — يظهران للمهندس فقط إذا عُبّئا.
  const saveFactoryNote = async (project: ProjectSummary, factoryDueDate: string, factoryNote: string) => {
    setError("");
    try {
      const data = await api<{ project: ProjectSummary }>(`/api/projects/${project.id}/materials`, {
        method: "POST",
        body: JSON.stringify({ factoryDueDate, factoryNote }),
      });
      setProjects(list => list.map(p => (p.id === project.id ? { ...p, ...data.project } : p)));
      if (openProject?.id === project.id) setOpenProject(p => (p ? { ...p, ...data.project } : p));
    } catch (e) {
      setError(e instanceof Error && e.message ? `تعذر حفظ الملاحظة: ${e.message}` : "تعذر حفظ الملاحظة، حاول مجددًا");
      load();
    }
  };

  // مراحل النجارة/الدهان/التنجيد/اكتمال التصنيع تُحتسب في النسبة (على الخادم).
  const toggleWorkStage = async (project: ProjectSummary, key: string, checked: boolean) => {
    const current = parseStages(project.stages);
    const next = checked ? [...current, key] : current.filter(k => k !== key);
    const optimistic = { stages: JSON.stringify(next), completionPercent: stagesToPercent(next) };
    setProjects(list => list.map(p => (p.id === project.id ? { ...p, ...optimistic } : p)));
    if (openProject?.id === project.id) setOpenProject(p => (p ? { ...p, ...optimistic } : p));
    setError("");
    try {
      const data = await api<{ project: ProjectSummary }>(`/api/projects/${project.id}/progress`, {
        method: "POST",
        body: JSON.stringify({ stages: next }),
      });
      setProjects(list => list.map(p => (p.id === project.id ? { ...p, ...data.project } : p)));
      if (openProject?.id === project.id) setOpenProject(p => (p ? { ...p, ...data.project } : p));
    } catch (e) {
      setError(e instanceof Error && e.message ? `تعذر حفظ المرحلة: ${e.message}` : "تعذر حفظ المرحلة، حاول مجددًا");
      load();
    }
  };

  // المصنع يحرّك مراحل التنفيذ فقط؛ التواريخ يحدّدها المهندس.
  const updateStage = async (id: string, status: ProjectStatus) => {
    setError("");
    try {
      const data = await api<{ project: ProjectSummary }>(`/api/projects/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      setProjects((list) => list.map((p) => (p.id === id ? { ...p, ...data.project } : p)));
      if (openProject?.id === id) setOpenProject((p) => (p ? { ...p, ...data.project } : p));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "تعذر تحديث مرحلة المشروع");
      load();
    }
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="factory-shell" dir="rtl">
      <header className="topbar no-print">
        <div className="brand">
          <div className="brand-mark"><Factory size={16} /></div>
          <div><strong>بوابة <em>المصنع</em></strong><span>المشاريع المعتمدة وجاهزة للتنفيذ</span></div>
        </div>
        <div className="top-actions">
          <NotificationsBell projects={projects} onOpen={openDetails} />
          <div className="user-chip" title={user.username}>{user.displayName}</div>
          <button className="icon-button" title="تسجيل الخروج" onClick={logout}><LogOut size={16} /></button>
        </div>
      </header>

      {!openProject && (
        <div className="factory-body">
          {error && <p className="auth-error factory-error">{error}</p>}
          {loading && <p className="auth-hint">جارٍ التحميل...</p>}
          {!loading && projects.length === 0 && (
            <div className="empty-state factory-empty"><Sparkles size={20} /><p>لا توجد مشاريع معتمدة حاليًا. سيظهر أي مشروع هنا فور اعتماده من قسم المهندس.</p></div>
          )}
          <div className="factory-grid">
            {projects.map((p) => {
              const remaining = dueDateInfo(p.dueDate);
              return (
                <div className="factory-card" key={p.id}>
                  <div className="factory-card-head">
                    <strong>{p.name}</strong>
                    <span className={`status-pill status-${p.status}`}>{STATUS_LABELS[p.status]}</span>
                    {p.clientName && <span className="factory-client">العميل: {p.clientName}{p.clientNumber ? ` #${p.clientNumber}` : ''}</span>}
                  </div>
                  <div className="factory-dates">
                    <div><span>تاريخ الاستلام من المهندس</span><strong>{p.startDate ? new Date(p.startDate).toLocaleDateString("ar-SA") : "—"}</strong></div>
                    <div><span>التسليم المتوقع</span><strong>{p.dueDate ? new Date(p.dueDate).toLocaleDateString("ar-SA") : "—"}</strong></div>
                  </div>
                  <span className={`remaining-pill tone-${remaining.tone}`}>{remaining.text}</span>

                  <FactoryNotePanel project={p} onSave={saveFactoryNote} />

                  <label className="field factory-stage-field"><span>مرحلة التنفيذ</span>
                    <select value={p.status} onChange={(e) => updateStage(p.id, e.target.value as ProjectStatus)}>
                      {FACTORY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </label>

                  {/* جدولان جنبًا إلى جنب: توريد الخامات (يمينًا، للمصنع فقط)
                      ومراحل المشروع (يسارًا، تظهر للمهندس والمحاسب). */}
                  <div className="factory-tables">
                    <div className="work-stages">
                      <span className="work-stages-title">توريد الخامات <em>مساعدة داخلية</em></span>
                      {MATERIAL_STAGES.map((item) => {
                        const done = parseMaterials(p.materials).includes(item.key);
                        return (
                          <label className={`work-stage ${done ? "is-done" : ""}`} key={item.key}>
                            <input type="checkbox" checked={done} onChange={(e) => toggleMaterial(p, item.key, e.target.checked)} />
                            <span>{item.label}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="work-stages">
                      <span className="work-stages-title">مراحل المشروع <em>تؤثر في النسبة</em></span>
                      {WORK_STAGES.map((stage) => {
                        const done = parseStages(p.stages).includes(stage.key);
                        return (
                          <label className={`work-stage ${done ? "is-done" : ""} ${stage.counted ? "" : "is-uncounted"}`} key={stage.key}>
                            <input type="checkbox" checked={done} onChange={(e) => toggleWorkStage(p, stage.key, e.target.checked)} />
                            <span>{stage.label}{stage.counted ? "" : " (خارج النسبة)"}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="progress-edit">
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${p.completionPercent}%` }} /></div>
                    <div className="progress-row">
                      <span className="progress-caption">نسبة الإنجاز</span>
                      <strong>{p.completionPercent}%</strong>
                    </div>
                    {p.completionUpdatedAt && <small>آخر تحديث: {new Date(p.completionUpdatedAt).toLocaleString("ar-SA")}</small>}
                  </div>

                  <button className="outline-button factory-open-btn" onClick={() => openDetails(p.id)}>عرض تفاصيل الكتالوج</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openProject && (
        <div className="factory-viewer">
          <div className="canvas-toolbar no-print">
            <button className="outline-button" onClick={() => setOpenProject(null)}><ArrowRight size={15} /> رجوع للقائمة</button>
            <div className="canvas-actions"><button onClick={() => window.print()}><Printer size={15} /></button></div>
          </div>
          <FactoryActivityPanel projectId={openProject.id} />
          <div className="canvas-scroll factory-pages-scroll">
            {openProject.data.pages.filter((p) => !p.hidden).map((p, index) => (
              <div className="factory-page-wrapper" key={p.id}>
                <CatalogPageView page={p} pageNumber={index + 1} settings={openProject.data.settings} clientNumber={openProject.clientNumber} readOnly />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FactoryActivityPanel({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  useEffect(() => {
    api<{ activity: ActivityEntry[] }>(`/api/projects/${projectId}/activity`).then((d) => setItems(d.activity.slice(0, 5))).catch(() => undefined);
  }, [projectId]);
  if (items.length === 0) return null;
  return (
    <div className="factory-activity-strip no-print">
      {items.map((entry) => (
        <span key={entry.id}>{activityLine(entry)} · {new Date(entry.createdAt).toLocaleDateString("ar-SA")}</span>
      ))}
    </div>
  );
}
