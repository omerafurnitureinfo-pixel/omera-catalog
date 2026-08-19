"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function SetupPage() {
  const [checking, setChecking] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [checkError, setCheckError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/bootstrap")
      .then((r) => r.json())
      .then((data) => setNeedsSetup(Boolean(data.needsSetup)))
      .catch(() => setCheckError("تعذر الاتصال بالخادم. تأكد من إعداد قاعدة البيانات."))
      .finally(() => setChecking(false));
  }, []);

  const submit = async () => {
    setError("");
    if (password !== password2) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, displayName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذر إنشاء الحساب");
        setBusy(false);
        return;
      }
      window.location.href = "/";
    } catch {
      setError("تعذر الاتصال بالخادم");
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell" dir="rtl">
      <div className="auth-card">
        <div className="auth-mark"><ShieldCheck size={22} /></div>
        <h1>إعداد النظام لأول مرة</h1>
        {checking && <p className="auth-hint"><Loader2 className="spin" size={14} /> جارٍ التحقق...</p>}
        {!checking && checkError && <p className="auth-error">{checkError}</p>}
        {!checking && !checkError && !needsSetup && (
          <>
            <p className="auth-hint">تم إعداد النظام مسبقًا ويوجد حساب مهندس بالفعل.</p>
            <a className="primary-button auth-submit" href="/login">الذهاب إلى تسجيل الدخول</a>
          </>
        )}
        {!checking && !checkError && needsSetup && (
          <>
            <p className="auth-hint">أنشئ حساب المهندس الرئيسي. من خلاله ستدير لاحقًا كل حسابات المصنع والمهندسين الأخرى.</p>
            <label className="field"><span>اسم المستخدم</span><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="مثال: omera-admin" /></label>
            <label className="field"><span>الاسم الظاهر</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="مثال: إدارة أوميرا" /></label>
            <label className="field"><span>كلمة المرور</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <label className="field"><span>تأكيد كلمة المرور</span><input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} /></label>
            {error && <p className="auth-error">{error}</p>}
            <button className="primary-button auth-submit" disabled={busy} onClick={submit}>{busy ? "جارٍ الإنشاء..." : "إنشاء الحساب والدخول"}</button>
          </>
        )}
      </div>
    </div>
  );
}
