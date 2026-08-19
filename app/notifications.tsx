"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { dueDateInfo } from "./lib/project-utils";

type AlertableProject = { id: string; name: string; clientName: string; dueDate: string | null; status: string };

// جرس تنبيهات بسيط يعمل من بيانات المشاريع المُحمَّلة أصلاً في الواجهة
// (بلا حاجة لخادم بريد أو واتساب) — يبرز المشاريع المتأخرة أو القريبة من
// موعد التسليم حتى لا يفوّت المهندس أو المصنع أي موعد.
export function NotificationsBell({ projects, onOpen }: { projects: AlertableProject[]; onOpen?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const alerts = projects
    .filter((p) => p.status !== "delivered" && p.status !== "draft")
    .map((p) => ({ project: p, due: dueDateInfo(p.dueDate) }))
    .filter((entry) => entry.due.tone === "warn" || entry.due.tone === "late")
    .sort((a, b) => (a.due.diffDays ?? 0) - (b.due.diffDays ?? 0));

  return (
    <div className="notif-bell no-print" ref={ref}>
      <button className="icon-button" title="التنبيهات" aria-label="التنبيهات" onClick={() => setOpen((v) => !v)}>
        <Bell size={17} />
        {alerts.length > 0 && <span className="notif-count">{alerts.length}</span>}
      </button>
      {open && (
        <div className="notif-panel">
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
