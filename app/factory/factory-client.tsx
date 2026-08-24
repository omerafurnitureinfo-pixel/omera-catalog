"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Factory, LogOut, Printer, Sparkles } from "lucide-react";
import { CatalogPage } from "../catalog-types";
import { CatalogPageView } from "../catalog-view";
import { NotificationsBell } from "../notifications";
import { FACTORY_STATUSES, ProjectStatus, ProjectSummary, STATUS_LABELS, dueDateInfo } from "../lib/project-utils";

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

  const updateProgress = async (id: string, value: number) => {
    setProjects((list) => list.map((p) => (p.id === id ? { ...p, completionPercent: value } : p)));
    if (openProject?.id === id) setOpenProject((p) => (p ? { ...p, completionPercent: value } : p));
    try {
      await api(`/api/projects/${id}/progress`, { method: "POST", body: JSON.stringify({ completionPercent: value }) });
    } catch (e) {
      setError(e instanceof Error && e.message ? `تعذر حفظ نسبة الإنجاز: ${e.message}` : "تعذر حفظ نسبة الإنجاز، حاول مجددًا");
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

                  <label className="field factory-stage-field"><span>مرحلة التنفيذ</span>
                    <select value={p.status} onChange={(e) => updateStage(p.id, e.target.value as ProjectStatus)}>
                      {FACTORY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </label>

                  <div className="progress-edit">
                    <div className="progress-bar"><div className="progress-fill" style={{ width: `${p.completionPercent}%` }} /></div>
                    <div className="progress-row">
                      <input type="range" min={0} max={100} step={5} value={p.completionPercent} onChange={(e) => updateProgress(p.id, Number(e.target.value))} />
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
