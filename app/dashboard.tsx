"use client";

import { useEffect, useState } from "react";
import { FilePlus2, Hash, Layers, LayoutTemplate, LogOut, Sparkles, Trash2, Users } from "lucide-react";
import { NotificationsBell } from "./notifications";
import { AccountsModal } from "./accounts-modal";
import {
  DASHBOARD_GROUP_LABELS, DashboardGroup, ProjectSummary, STATUS_LABELS, dashboardGroupOf,
} from "./lib/project-utils";

type SessionUser = { id: number; username: string; displayName: string; role: "engineer" | "factory" };
type FactoryUpdate = { id: number; projectId: string; projectName: string; userDisplayName: string; details: string | null; createdAt: string };

async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "حدث خطأ غير متوقع");
  return data as T;
}

const GROUP_ORDER: DashboardGroup[] = ["pending", "active", "delivered"];

function ProjectRow({ project, onOpen, onEditCode, onDelete }: {
  project: ProjectSummary;
  onOpen: (id: string) => void;
  onEditCode?: (project: ProjectSummary) => void;
  onDelete?: (project: ProjectSummary) => void;
}) {
  // اسم العميل هو العنوان الأساسي، وكود العميل أسفل منه مباشرة.
  const title = project.clientName?.trim() || project.name || "بلا عميل بعد";
  return (
    <div className="dash-project-row" role="button" tabIndex={0}
      onClick={() => onOpen(project.id)}
      onKeyDown={e => e.key === "Enter" && onOpen(project.id)}>
      <div className="dash-project-row-main">
        <strong>{title}</strong>
        <span>{project.clientNumber ? `كود العميل: ${project.clientNumber}` : "بلا كود عميل"}</span>
      </div>
      <span className={`status-pill status-${project.status}`}>{STATUS_LABELS[project.status]}</span>
      {onEditCode && (
        <button className="dash-row-action" title="تغيير كود العميل"
          onClick={e => { e.stopPropagation(); onEditCode(project); }}>
          <Hash size={14} />
        </button>
      )}
      {onDelete && (
        <button className="dash-row-action danger" title="حذف المشروع"
          onClick={e => { e.stopPropagation(); onDelete(project); }}>
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

export function Dashboard({ user, projects, loading, onOpenProject, onCreateProject, onLogout, onShowAll, onProjectsChanged }: {
  user: SessionUser;
  projects: ProjectSummary[];
  loading: boolean;
  onOpenProject: (id: string) => void;
  onCreateProject: (clientName: string) => void;
  onLogout: () => void;
  onShowAll: () => void;
  onProjectsChanged: () => void;
}) {
  const [feed, setFeed] = useState<FactoryUpdate[]>([]);
  const [showAccounts, setShowAccounts] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api<{ updates: FactoryUpdate[] }>("/api/activity").then(d => setFeed(d.updates)).catch(() => undefined); }, []);

  const createProject = () => {
    const clientName = window.prompt("اسم العميل للمشروع الجديد:");
    if (clientName === null || !clientName.trim()) return;
    onCreateProject(clientName);
  };

  const editCode = async (project: ProjectSummary) => {
    const entered = window.prompt(`كود العميل لمشروع "${project.clientName || project.name}":`, project.clientNumber ? String(project.clientNumber) : "");
    if (entered === null) return;
    setError("");
    try {
      await api(`/api/projects/${project.id}`, { method: "PUT", body: JSON.stringify({ clientNumber: entered.trim() === "" ? null : Number(entered.trim()) }) });
      onProjectsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تغيير كود العميل");
    }
  };

  const deleteProject = async (project: ProjectSummary) => {
    if (!window.confirm(`حذف مشروع "${project.clientName || project.name}" نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    setError("");
    try {
      await api(`/api/projects/${project.id}`, { method: "DELETE" });
      onProjectsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف المشروع");
    }
  };

  const grouped: Record<DashboardGroup, ProjectSummary[]> = { pending: [], active: [], delivered: [] };
  for (const p of projects) grouped[dashboardGroupOf(p.status)].push(p);
  const recent = [...projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 6);

  return (
    <div className="app-shell dashboard-shell" dir="rtl">
      <header className="topbar no-print">
        <div className="brand"><div className="brand-mark"><Sparkles size={16} /></div><div><strong>لوحة <em>التحكم</em></strong><span>نظرة عامة على كل المشاريع</span></div></div>
        <div className="top-actions">
          <button className="primary-button" onClick={createProject}><FilePlus2 size={16} /> مشروع جديد</button>
          <button className="outline-button" onClick={() => setShowAccounts(true)}><Users size={16} /> الحسابات</button>
          <NotificationsBell projects={projects} onOpen={onOpenProject} />
          <span className="separator" />
          <div className="user-chip" title={user.username}>{user.displayName}</div>
          <button className="icon-button" title="تسجيل الخروج" onClick={onLogout}><LogOut size={16} /></button>
        </div>
      </header>
      {showAccounts && <AccountsModal onClose={() => setShowAccounts(false)} />}

      <div className="dashboard-body">
        {loading && <p className="auth-hint">جارٍ التحميل...</p>}
        {error && <p className="auth-error">{error}</p>}

        <section className="dashboard-feed">
          <p className="section-label"><span className="section-label-title"><Layers size={13} /> تحديثات المصنع</span></p>
          {feed.length === 0 && <p className="empty-state">لا توجد تحديثات من المصنع بعد. تظهر هنا فور تحديث المصنع لنسبة إنجاز أي مشروع.</p>}
          {feed.length > 0 && (
            <div className="factory-feed-list">
              {feed.map(entry => (
                <button className="factory-feed-item" key={entry.id} onClick={() => onOpenProject(entry.projectId)}>
                  <strong>{entry.projectName}</strong>
                  <span>{entry.userDisplayName} حدّث نسبة الإنجاز إلى {entry.details}</span>
                  <small>{new Date(entry.createdAt).toLocaleString("ar-SA")}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="dashboard-groups">
          {GROUP_ORDER.map(group => (
            <section className="dashboard-group" key={group}>
              <p className="section-label">{DASHBOARD_GROUP_LABELS[group]} <span className="dash-count">{grouped[group].length}</span></p>
              {grouped[group].length === 0 && <p className="empty-state">لا توجد مشاريع هنا حاليًا.</p>}
              <div className="dash-project-list">
                {grouped[group].map(project => <ProjectRow key={project.id} project={project} onOpen={onOpenProject} onEditCode={editCode} onDelete={deleteProject} />)}
              </div>
            </section>
          ))}
        </div>

        <section className="dashboard-recent">
          <p className="section-label"><span className="section-label-title"><LayoutTemplate size={13} /> المشاريع السابقة</span><button onClick={onShowAll}>عرض الكل وبحث</button></p>
          {recent.length === 0 && !loading && <p className="empty-state">لا توجد مشاريع بعد — ابدأ بإنشاء أول مشروع.</p>}
          <div className="dash-project-list">
            {recent.map(project => <ProjectRow key={project.id} project={project} onOpen={onOpenProject} onEditCode={editCode} onDelete={deleteProject} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
