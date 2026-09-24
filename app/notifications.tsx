"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { dueDateInfo } from "./lib/project-utils";

type AlertableProject = { id: string; name: string; clientName: string; dueDate: string | null; status: string };

type EditNotification = {
  id: number;
  projectId: string;
  projectName: string;
  clientName: string;
  clientNumber: number | null;
  page: number | null;
  text: string;
  by: string;
  createdAt: string;
};

// علامة "تمّت المشاهدة" محليّة لكل جهاز — تكفي لعدّاد الجرس ولا تحتاج
// عمودًا في قاعدة البيانات.
const SEEN_KEY = "omera-notif-seen-at";
const readSeenAt = (): string => {
  try { return window.localStorage.getItem(SEEN_KEY) ?? ""; } catch { return ""; }
};
const writeSeenAt = (value: string) => {
  try { window.localStorage.setItem(SEEN_KEY, value); } catch { /* وضع التصفح الخاص */ }
};

const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return `قبل ${days} يوم`;
};

// جرس التنبيهات: مواعيد التسليم القريبة/المتأخرة (محسوبة في الواجهة) +
// إشعارات تعديل المهندس للكتالوج بعد الاعتماد (تأتي من الخادم للمصنع).
export function NotificationsBell({ projects, onOpen }: { projects: AlertableProject[]; onOpen?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState<EditNotification[]>([]);
  const [seenAt, setSeenAt] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => { setSeenAt(readSeenAt()); }, []);

  // تُجلب عند التحميل ثم كل دقيقة، فيظهر تعديل المهندس عند المصنع بلا
  // إعادة تحميل الصفحة. غير المصنع تعود له قائمة فارغة من الخادم.
  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : { notifications: [] }))
        .then((d: any) => { if (alive) setEdits((d?.notifications as EditNotification[]) ?? []); })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  const alerts = projects
    .filter((p) => p.status !== "delivered" && p.status !== "draft")
    .map((p) => ({ project: p, due: dueDateInfo(p.dueDate) }))
    .filter((entry) => entry.due.tone === "warn" || entry.due.tone === "late")
    .sort((a, b) => (a.due.diffDays ?? 0) - (b.due.diffDays ?? 0));

  const isUnseen = (edit: EditNotification) => !seenAt || edit.createdAt > seenAt;
  const count = alerts.length + edits.filter(isUnseen).length;

  const toggle = () => {
    setOpen((wasOpen) => {
      if (!wasOpen && edits.length > 0) {
        const newest = edits.reduce((max, e) => (e.createdAt > max ? e.createdAt : max), "");
        if (newest) { writeSeenAt(newest); setSeenAt(newest); }
      }
      return !wasOpen;
    });
  };

  return (
    <div className="notif-bell no-print" ref={ref}>
      <button className="icon-button" title="التنبيهات" aria-label="التنبيهات" onClick={toggle}>
        <Bell size={17} />
        {count > 0 && <span className="notif-count">{count}</span>}
      </button>
      {open && (
        <div className="notif-panel">
          {edits.length > 0 && (
            <>
              <div className="notif-panel-head">تعديلات المهندس على الكتالوج</div>
              {edits.map((edit) => (
                <button
                  key={edit.id}
                  className={`notif-item notif-edit ${isUnseen(edit) ? "is-unseen" : ""}`}
                  onClick={() => { setOpen(false); onOpen?.(edit.projectId); }}
                >
                  <strong>{edit.page === null ? "تم تعديل الكتالوج" : `تم تعديل معلومات صفحة رقم ${edit.page}`}</strong>
                  <span className="notif-change">{edit.text}</span>
                  <em>
                    {edit.projectName}
                    {edit.clientNumber ? ` • ${edit.clientNumber}` : ""}
                    {` • ${relativeTime(edit.createdAt)}`}
                  </em>
                </button>
              ))}
            </>
          )}

          <div className="notif-panel-head">تنبيهات المواعيد</div>
          {alerts.length === 0 && <p className="notif-empty">لا توجد مواعيد قريبة أو متأخرة حاليًا.</p>}
          {alerts.map(({ project, due }) => (
            <button
              key={project.id}
              className={`notif-item tone-${due.tone}`}
              onClick={() => { setOpen(false); onOpen?.(project.id); }}
            >
              <strong>{project.name}</strong>
              {project.clientName && <span>{project.clientName}</span>}
              <em>{due.text}</em>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
