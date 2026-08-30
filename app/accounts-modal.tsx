"use client";

import { useEffect, useState } from "react";
import { Trash2, UserPlus, X } from "lucide-react";
import { Field } from "./catalog-view";

async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "حدث خطأ غير متوقع");
  return data as T;
}

// إدارة حسابات الدخول — نافذة مستقلة تُفتح من لوحة التحكم فقط (وليست جزءًا
// من محرر بيانات مشروع معيّن)، لأنها إعداد على مستوى النظام كله لا علاقة له
// بمشروع بعينه.
export function AccountsModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<{ id: number; username: string; displayName: string; role: string }[]>([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'engineer' | 'factory' | 'accountant'>('factory');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => { api<{ users: typeof list }>('/api/users').then(d => setList(d.users)).catch(() => undefined); };
  useEffect(load, []);

  const create = async () => {
    setError('');
    setBusy(true);
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify({ username, password, displayName, role }) });
      setUsername(''); setDisplayName(''); setPassword('');
      load();
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر إنشاء الحساب'); } finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    if (!window.confirm('حذف هذا الحساب؟')) return;
    try { await api(`/api/users/${id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر الحذف'); }
  };

  return <div className="modal-backdrop no-print" onClick={onClose}><div className="modal accounts-modal" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">الوصول</span><h2>إدارة حسابات الدخول</h2></div><button onClick={onClose}><X size={19} /></button></div>
    <div className="accounts-body">
      <div className="accounts-list">
        {list.map(item => <div className="account-row" key={item.id}><span className={`role-pill ${item.role}`}>{item.role === 'engineer' ? 'مهندس' : item.role === 'accountant' ? 'محاسب' : 'مصنع'}</span><div><strong>{item.displayName}</strong><small>{item.username}</small></div><button className="icon-button" onClick={() => remove(item.id)}><Trash2 size={15} /></button></div>)}
        {list.length === 0 && <p className="empty-state">لا توجد حسابات إضافية بعد.</p>}
      </div>
      <div className="divider" />
      <p className="section-label">إضافة حساب جديد</p>
      <div className="two-fields">
        <Field label="اسم المستخدم" value={username} onChange={setUsername} />
        <Field label="الاسم الظاهر" value={displayName} onChange={setDisplayName} />
      </div>
      <div className="two-fields">
        <label className="field"><span>كلمة المرور</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label className="field"><span>نوع الحساب</span><select value={role} onChange={e => setRole(e.target.value as 'engineer' | 'factory' | 'accountant')}><option value="factory">مصنع</option><option value="engineer">مهندس</option><option value="accountant">محاسب</option></select></label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      <button className="add-page-button wide" disabled={busy} onClick={create}><UserPlus size={15} /> إنشاء الحساب</button>
    </div>
  </div></div>;
}
