"use client";

import { useEffect, useState } from "react";
import { Factory, Ruler, ArrowRight, Loader2, Wallet } from "lucide-react";

type Role = "engineer" | "factory" | "accountant";

const ROLE_INFO: Record<Role, { title: string; icon: typeof Ruler }> = {
  engineer: { title: "دخول قسم المهندس", icon: Ruler },
  factory: { title: "دخول قسم المصنع", icon: Factory },
  accountant: { title: "دخول قسم المحاسبة", icon: Wallet },
};

export default function LoginPage() {
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [role, setRole] = useState<Role | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/bootstrap")
      .then((r) => r.json())
      .then((data) => {
        if (data.needsSetup) window.location.href = "/setup";
      })
      .catch(() => undefined)
      .finally(() => setCheckingSetup(false));
  }, []);

  const submit = async () => {
    if (!role) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذر تسجيل الدخول");
        setBusy(false);
        return;
      }
      window.location.href = role === "factory" ? "/factory" : role === "accountant" ? "/accountant" : "/";
    } catch {
      setError("تعذر الاتصال بالخادم");
      setBusy(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="auth-shell" dir="rtl">
        <p className="auth-hint"><Loader2 className="spin" size={14} /> جارٍ التحميل...</p>
      </div>
    );
  }

  return (
    <div className="auth-shell" dir="rtl">
      <div className="auth-card">
        <h1>محرّر أوميرا</h1>
        <p className="auth-hint">اختر بوابة الدخول المناسبة.</p>

        {!role && (
          <div className="role-grid">
            <button className="role-card" onClick={() => setRole("engineer")}>
              <Ruler size={26} />
              <strong>قسم المهندس</strong>
              <span>إنشاء وتحرير الكتالوجات والاعتماد</span>
            </button>
            <button className="role-card" onClick={() => setRole("factory")}>
              <Factory size={26} />
              <strong>قسم المصنع</strong>
              <span>متابعة المشاريع المعتمدة والتنفيذ</span>
            </button>
            <button className="role-card" onClick={() => setRole("accountant")}>
              <Wallet size={26} />
              <strong>قسم المحاسبة</strong>
              <span>متابعة السداد ومطالبات العملاء</span>
            </button>
          </div>
        )}

        {role && (
          <>
            <button className="back-link" onClick={() => { setRole(null); setError(""); }}>
              <ArrowRight size={14} /> تغيير البوابة
            </button>
            <div className="role-chip">{(() => { const Icon = ROLE_INFO[role].icon; return <Icon size={14} />; })()} {ROLE_INFO[role].title}</div>
            <label className="field"><span>اسم المستخدم</span><input value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></label>
            <label className="field"><span>كلمة المرور</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} /></label>
            {error && <p className="auth-error">{error}</p>}
            <button className="primary-button auth-submit" disabled={busy} onClick={submit}>{busy ? "جارٍ الدخول..." : "تسجيل الدخول"}</button>
          </>
        )}
      </div>
    </div>
  );
}
