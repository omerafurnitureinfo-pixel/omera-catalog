"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, LogOut, Sparkles, Wallet } from "lucide-react";
import {
  PaymentAlert, ProjectSummary, STATUS_LABELS, WORK_STAGES,
  formatAmount, parseStages, paymentAlertFor, paymentPercent, remainingAmount,
} from "../lib/project-utils";

type SessionUser = { id: number; username: string; displayName: string; role: string };

async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "حدث خطأ غير متوقع");
  return data as T;
}

function AlertsPanel({ alerts, onOpen }: { alerts: { project: ProjectSummary; alert: PaymentAlert }[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="notif-bell">
      <button className="icon-button" title="تنبيهات المطالبة" aria-label="تنبيهات المطالبة" onClick={() => setOpen(v => !v)}>
        <Bell size={17} />
        {alerts.length > 0 && <span className="notif-count">{alerts.length}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">تنبيهات مطالبة العملاء</div>
          {alerts.length === 0 && <p className="notif-empty">لا توجد مطالبات مستحقة حاليًا.</p>}
          {alerts.map(({ project, alert }) => (
            <button key={project.id} className={`notif-item alert-${alert.level}`} onClick={() => { setOpen(false); onOpen(project.id); }}>
              <strong>{project.clientName?.trim() || project.name}</strong>
              <span>{project.clientNumber ? `كود العميل: ${project.clientNumber}` : "بلا كود"}</span>
              <em>{alert.text}</em>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ project, onSave }: { project: ProjectSummary; onSave: (id: string, total: string, paid: string) => Promise<void> }) {
  const [total, setTotal] = useState(project.totalAmount != null ? String(project.totalAmount) : "");
  const [paid, setPaid] = useState(project.paidAmount != null ? String(project.paidAmount) : "");
  const [busy, setBusy] = useState(false);

  // نبقي الحقول متزامنة مع الخادم بعد كل حفظ ناجح أو إعادة تحميل.
  useEffect(() => { setTotal(project.totalAmount != null ? String(project.totalAmount) : ""); }, [project.totalAmount]);
  useEffect(() => { setPaid(project.paidAmount != null ? String(project.paidAmount) : ""); }, [project.paidAmount]);

  const paidPct = paymentPercent(project);
  const remaining = remainingAmount(project);
  const alert = paymentAlertFor(project);
  const settled = paidPct !== null && paidPct >= 100;
  const dirty = total !== (project.totalAmount != null ? String(project.totalAmount) : "")
    || paid !== (project.paidAmount != null ? String(project.paidAmount) : "");

  const save = async () => { setBusy(true); try { await onSave(project.id, total, paid); } finally { setBusy(false); } };

  return (
    <div className={`accountant-card ${settled ? "is-settled" : ""}`}>
      <div className="accountant-card-head">
        <strong>{project.clientName?.trim() || project.name}</strong>
        <span className={`status-pill status-${project.status}`}>{STATUS_LABELS[project.status]}</span>
        <span className="factory-client">{project.clientNumber ? `كود العميل: ${project.clientNumber}` : "بلا كود عميل"}</span>
      </div>

      {alert && (
        <p className={`payment-alert alert-${alert.level}`}>
          <AlertTriangle size={13} /> {alert.text}
        </p>
      )}

      <div className="stage-chips">
        {WORK_STAGES.map(stage => (
          <span key={stage.key} className={`stage-chip ${parseStages(project.stages).includes(stage.key) ? "is-done" : ""}`}>{stage.label}</span>
        ))}
      </div>

      <div className="accountant-progress">
        <span>نسبة الإنجاز من المصنع</span>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${project.completionPercent}%` }} /></div>
        <strong>{project.completionPercent}%</strong>
      </div>

      <div className="accountant-progress">
        <span>نسبة السداد</span>
        <div className="progress-bar"><div className="progress-fill paid" style={{ width: `${paidPct ?? 0}%` }} /></div>
        <strong>{paidPct === null ? "—" : `${paidPct}%`}</strong>
      </div>

      <div className="two-fields">
        <label className="field"><span>إجمالي العقد</span>
          <input type="number" min={0} step="0.01" value={total} onChange={e => setTotal(e.target.value)} placeholder="0" />
        </label>
        <label className="field"><span>المبلغ المدفوع</span>
          <input type="number" min={0} step="0.01" value={paid} onChange={e => setPaid(e.target.value)} placeholder="0" />
        </label>
      </div>

      <div className="accountant-remaining">
        <span>المتبقي</span>
        <strong>{settled ? "مسدَّد بالكامل" : formatAmount(remaining)}</strong>
      </div>

      <button className="primary-button accountant-save" disabled={busy || !dirty} onClick={save}>
        {busy ? "جارٍ الحفظ..." : "حفظ بيانات السداد"}
      </button>
      {project.paymentUpdatedAt && <small className="accountant-updated">آخر تحديث: {new Date(project.paymentUpdatedAt).toLocaleString("ar-SA")}</small>}
    </div>
  );
}

export default function AccountantClient({ user }: { user: SessionUser }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api<{ projects: ProjectSummary[] }>("/api/projects")
      .then(d => setProjects(d.projects))
      .catch(e => setError(e instanceof Error ? e.message : "تعذر تحميل الأوردرات"))
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

  const savePayment = async (id: string, total: string, paid: string) => {
    setError("");
    try {
      const data = await api<{ project: ProjectSummary }>(`/api/projects/${id}/payment`, {
        method: "POST",
        body: JSON.stringify({ totalAmount: total === "" ? null : Number(total), paidAmount: paid === "" ? null : Number(paid) }),
      });
      setProjects(list => list.map(p => (p.id === id ? { ...p, ...data.project } : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ بيانات السداد");
    }
  };

  const logout = async () => { await api("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; };

  const alerts = projects
    .map(project => ({ project, alert: paymentAlertFor(project) }))
    .filter((entry): entry is { project: ProjectSummary; alert: PaymentAlert } => entry.alert !== null)
    .sort((a, b) => b.alert.threshold - a.alert.threshold);

  const focusOrder = (id: string) => {
    document.getElementById(`order-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="factory-shell" dir="rtl">
      <header className="topbar no-print">
        <div className="brand">
          <div className="brand-mark"><Wallet size={16} /></div>
          <div><strong>قسم <em>المحاسبة</em></strong><span>متابعة السداد والمطالبات</span></div>
        </div>
        <div className="top-actions">
          <AlertsPanel alerts={alerts} onOpen={focusOrder} />
          <div className="user-chip" title={user.username}>{user.displayName}</div>
          <button className="icon-button" title="تسجيل الخروج" onClick={logout}><LogOut size={16} /></button>
        </div>
      </header>

      <div className="factory-body">
        {error && <p className="auth-error factory-error">{error}</p>}
        {loading && <p className="auth-hint">جارٍ التحميل...</p>}
        {!loading && projects.length === 0 && (
          <div className="empty-state factory-empty"><Sparkles size={20} /><p>لا توجد أوردرات معتمدة حاليًا. يظهر الأوردر هنا فور اعتماده من قسم المهندس.</p></div>
        )}
        <div className="factory-grid">
          {projects.map(project => (
            <div id={`order-${project.id}`} key={project.id}>
              <OrderCard project={project} onSave={savePayment} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
