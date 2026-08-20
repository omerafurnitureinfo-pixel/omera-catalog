"use client";

import { useEffect, useState } from "react";
import { FilePlus2, Layers, LayoutTemplate, LogOut, Sparkles } from "lucide-react";
import { NotificationsBell } from "./notifications";
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

function ProjectRow({ project, onOpen }: { project: ProjectSummary; onOpen: (id: string) => void }) {
  return (
    <button className="dash-project-row" onClick={() => onOpen(project.id)}>
      <div className="dash-project-row-main">
        <strong>{project.name}</strong>
        <span>{project.clientName ? `${project.clientName}${project.clientNumber ? ` #${project.clientNumber}` : ""}` : "بلا عميل بعد"}</span>
      </div>
      <span className={`status-pill status-${project.status}`}>{STATUS_LABELS[project.status]}</span>
    </button>
  );
}

export function Dashboard({ user, projects, loading, onOpenProject, onCreateProject, onLogout, onShowAll }: {
  user: SessionUser;
  projects: ProjectSummary[];
  loading: boolean;
  onOpenProject: (id: string) => void;
  onCreateProject: () => void;
  onLogout: () => void;
  onShowAll: () => void;
}) {
  const [feed, setFeed] = useState<FactoryUpdate[]>([]);
  useEffect(() => { api<{ updates: FactoryUpdate[] }>("/api/activity").then(d => setFeed(d.updates)).catch(() => undefined); }, []);

  const grouped: Record<DashboardGroup, ProjectSummary[]> = { pending: [], active: [], delivered: [] };
  for (const p of projects) grouped[dashboardGroupOf(p.status)].push(p);
  const recent = [...projects].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 6);

  return (
    <div className="app-shell dashboard-shell" dir="rtl">
      <header className="topbar no-print">
        <div className="brand"><div className="brand-mark"><Sparkles size={16} /></div><div><strong>لوحة <em>التحكم</em></strong><span>نظرة عامة على كل المشاريع</span></div></div>
        <div className="top-actions">
          <button className="primary-button" onClick={onCreateProject}><FilePlus2 size={16} /> مشروع جديد</button>
          <NotificationsBell projects={projects} onOpen={onOpenProject} />
          <span className="separator" />
          <div className="user-chip" title={user.username}>{user.displayName}</div>
          <button className="icon-button" title="تسجيل الخروج" onClick={onLogout}><LogOut size={16} /></button>
        </div>
      </header>

      <div className="dashboard-body">
        {loading && <p className="auth-hint">جارٍ التحميل...</p>}

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
                {grouped[group].map(project => <ProjectRow key={project.id} project={project} onOpen={onOpenProject} />)}
              </div>
            </section>
          ))}
        </div>

        <section className="dashboard-recent">
          <p className="section-label"><span className="section-label-title"><LayoutTemplate size={13} /> المشاريع السابقة</span><button onClick={onShowAll}>عرض الكل وبحث</button></p>
          {recent.length === 0 && !loading && <p className="empty-state">لا توجد مشاريع بعد — ابدأ بإنشاء أول مشروع.</p>}
          <div className="dash-project-list">
            {recent.map(project => <ProjectRow key={project.id} project={project} onOpen={onOpenProject} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
