"use client";

import { useState } from "react";
import { FilePlus2, X } from "lucide-react";

// نافذة إنشاء مشروع جديد: اسم العميل + كود العميل. الكود يظهر مقترحًا
// (التالي في التسلسل) ويقدر المهندس يغيّره قبل الإنشاء.
export function NewProjectModal({ suggestedNumber, onClose, onCreate }: {
  suggestedNumber: number;
  onClose: () => void;
  onCreate: (clientName: string, clientNumber: number) => Promise<void>;
}) {
  const [clientName, setClientName] = useState("");
  const [clientNumber, setClientNumber] = useState(String(suggestedNumber));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!clientName.trim()) { setError("أدخل اسم العميل"); return; }
    const parsed = Number(clientNumber.trim());
    if (!Number.isInteger(parsed) || parsed <= 0) { setError("كود العميل يجب أن يكون رقمًا صحيحًا موجبًا"); return; }
    setBusy(true);
    try {
      await onCreate(clientName.trim(), parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر إنشاء المشروع");
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop no-print" onClick={onClose}>
      <div className="modal new-project-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div><span className="eyebrow">مشروع جديد</span><h2>بيانات العميل</h2></div>
          <button onClick={onClose}><X size={19} /></button>
        </div>
        <div className="approval-body">
          <label className="field"><span>اسم العميل</span>
            <input autoFocus value={clientName} onChange={e => setClientName(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="اسم العميل" />
          </label>
          <label className="field"><span>كود العميل</span>
            <input value={clientNumber} onChange={e => setClientNumber(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} inputMode="numeric" />
          </label>
          <p className="approval-hint">الكود مقترح تلقائيًا كتالي رقم في التسلسل، وتقدر تغيّره الآن أو لاحقًا.</p>
          {error && <p className="auth-error">{error}</p>}
        </div>
        <div className="modal-foot">
          <span />
          <button className="primary-button" disabled={busy} onClick={submit}>
            <FilePlus2 size={16} /> {busy ? "جارٍ الإنشاء..." : "إنشاء المشروع"}
          </button>
        </div>
      </div>
    </div>
  );
}
