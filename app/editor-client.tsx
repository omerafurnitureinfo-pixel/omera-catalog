"use client";

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, BadgeCheck, ChevronLeft, Copy, Download, Eye, FileJson,
  FilePlus2, GripVertical, Import, LayoutTemplate, LogOut, Menu, Palette, Pencil, Plus, Printer, Redo2,
  Save, Search, Settings, ShieldCheck, Sparkles, Trash2, Undo2, Upload, UserPlus, Users, X, ZoomIn, ZoomOut
} from 'lucide-react';
import {
  CatalogPage, MaterialSample, PageKind, Project, ProductRow, isFieldVisible,
  logoPath, makePage, newProjectData, normalizeProjectData, pageNames, uid,
} from './catalog-types';
import { CatalogPageView, Field, ImagePlaceholder } from './catalog-view';
import { NotificationsBell } from './notifications';
import { PROJECT_STATUSES, ProjectStatus, STATUS_LABELS, isFactoryVisible } from './lib/project-utils';

type SessionUser = { id: number; username: string; displayName: string; role: 'engineer' | 'factory' };
type ProjectSummary = { id: string; name: string; clientName: string; status: ProjectStatus; statusUpdatedAt: string | null; startDate: string | null; dueDate: string | null; completionPercent: number; completionUpdatedAt: string | null; createdAt: string; updatedAt: string };
type ActivityEntry = { id: number; userDisplayName: string; action: string; details: string | null; createdAt: string };

async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'حدث خطأ غير متوقع');
  return data as T;
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button className="icon-button" onClick={onClick} title={label} aria-label={label}>{children}</button>;
}

function Thumb({ page }: { page: CatalogPage }) {
  return <div className="thumb-content"><span>{page.kind === 'cover' ? 'OMERA' : page.kind === 'technical' ? '⌗' : page.kind === 'materials' ? '●  ●  ●' : page.kind === 'plan' ? '⌘' : '◇'}</span><i>{page.kind === 'cover' ? 'كتالوج الأثاث' : page.title}</i><b /><b /><b /></div>;
}

export default function EditorClient({ user }: { user: SessionUser }) {
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('كتالوج جديد');
  const [pages, setPages] = useState<CatalogPage[]>([]);
  const [settings, setSettings] = useState<Record<string, string | boolean>>({});
  const [status, setStatus] = useState<ProjectSummary | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([]);

  const [selectedId, setSelectedId] = useState('');
  const [zoom, setZoom] = useState(72);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [toast, setToast] = useState('');
  const [history, setHistory] = useState<{ pages: CatalogPage[]; settings: Record<string, string | boolean> }[]>([]);
  const [future, setFuture] = useState<{ pages: CatalogPage[]; settings: Record<string, string | boolean> }[]>([]);
  const [draggedId, setDraggedId] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const selected = pages.find(page => page.id === selectedId) ?? pages[0];
  const visiblePages = pages.filter(page => !page.hidden);
  const saveMessage = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2200); };

  /* ---------------- تحميل المشروع من الخادم ---------------- */

  const openProjectById = async (id: string) => {
    const data = await api<{ project: { id: string; name: string; data: { settings: Record<string, string | boolean>; pages: CatalogPage[] } } & ProjectSummary }>(`/api/projects/${id}`);
    const normalized = normalizeProjectData(data.project.data);
    setProjectId(data.project.id);
    setProjectName(data.project.name);
    setPages(normalized.pages);
    setSettings(normalized.settings);
    setStatus(data.project);
    setSelectedId(normalized.pages[0]?.id ?? '');
    setHistory([]);
    setFuture([]);
  };

  const createNewProject = async (name = 'كتالوج جديد') => {
    const data = newProjectData();
    const id = uid();
    await api('/api/projects', { method: 'POST', body: JSON.stringify({ id, name, data }) });
    await openProjectById(id);
    saveMessage('تم إنشاء مشروع جديد');
  };

  const refreshProjectsList = () => { api<{ projects: ProjectSummary[] }>('/api/projects').then(d => setAllProjects(d.projects)).catch(() => undefined); };

  useEffect(() => {
    (async () => {
      try {
        const list = await api<{ projects: ProjectSummary[] }>('/api/projects');
        setAllProjects(list.projects);
        if (list.projects.length > 0) {
          await openProjectById(list.projects[0].id);
        } else {
          await createNewProject();
        }
      } catch {
        saveMessage('تعذر تحميل المشاريع من الخادم');
      } finally {
        setHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- حفظ تلقائي على الخادم ---------------- */

  useEffect(() => {
    if (!hydrated || !projectId) return;
    const timer = window.setTimeout(() => {
      api(`/api/projects/${projectId}`, { method: 'PUT', body: JSON.stringify({ name: projectName, data: { settings, pages } }) })
        .catch(() => saveMessage('تعذر حفظ المشروع، تحقق من الاتصال'));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [pages, settings, projectName, projectId, hydrated]);

  /* ---------------- أدوات التحرير (نفس منطق النسخة السابقة) ---------------- */

  const commit = (updater: (current: { pages: CatalogPage[] }) => { pages: CatalogPage[] }) => {
    setHistory(items => [...items.slice(-19), { pages, settings }]);
    setFuture([]);
    setPages(updater({ pages }).pages);
  };
  const updatePage = (updater: (page: CatalogPage) => CatalogPage) => commit(current => ({ pages: current.pages.map(page => page.id === selected.id ? updater(page) : page) }));
  const updateField = (key: string, value: string) => updatePage(page => ({ ...page, fields: { ...page.fields, [key]: value } }));
  const uploadImage = (file: File, callback: (data: string) => void) => { const reader = new FileReader(); reader.onload = () => callback(String(reader.result)); reader.readAsDataURL(file); };
  const undo = () => { const previous = history[history.length - 1]; if (!previous) return; setFuture(items => [...items, { pages, settings }]); setPages(previous.pages); setSettings(previous.settings); setHistory(items => items.slice(0, -1)); };
  const redo = () => { const next = future[future.length - 1]; if (!next) return; setHistory(items => [...items, { pages, settings }]); setPages(next.pages); setSettings(next.settings); setFuture(items => items.slice(0, -1)); };
  useEffect(() => { const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveMessage('يُحفظ المشروع تلقائيًا بعد كل تعديل'); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });

  const addPage = (kind: PageKind) => { const page = makePage(kind); commit(current => ({ pages: [...current.pages, page] })); setSelectedId(page.id); setShowTemplates(false); saveMessage(`أضيفت ${pageNames[kind]}`); };
  const duplicatePage = () => { const copy = { ...selected, id: uid(), title: `${selected.title} — نسخة`, fields: { ...selected.fields }, rows: selected.rows.map(row => ({ ...row, id: uid() })), samples: selected.samples.map(sample => ({ ...sample, id: uid() })) }; commit(current => ({ pages: [...current.pages, copy] })); setSelectedId(copy.id); };
  const deletePage = () => { if (pages.length <= 1) { saveMessage('يجب أن يحتوي المشروع على صفحة واحدة على الأقل'); return; } if (!window.confirm('هل تريد حذف هذه الصفحة؟')) return; const index = pages.findIndex(page => page.id === selected.id); commit(current => ({ pages: current.pages.filter(page => page.id !== selected.id) })); setSelectedId(pages[Math.max(0, index - 1)]?.id ?? ''); };
  const toggleHidden = (id: string) => commit(current => ({ pages: current.pages.map(page => page.id === id ? { ...page, hidden: !page.hidden } : page) }));
  const movePage = (direction: -1 | 1) => { const index = pages.findIndex(page => page.id === selected.id); const next = index + direction; if (next < 0 || next >= pages.length) return; const list = [...pages]; [list[index], list[next]] = [list[next], list[index]]; commit(() => ({ pages: list })); };
  const dropPage = (event: React.DragEvent<HTMLDivElement>, targetId: string) => { event.preventDefault(); if (!draggedId || draggedId === targetId) return; const list = [...pages]; const from = list.findIndex(page => page.id === draggedId); const to = list.findIndex(page => page.id === targetId); const [item] = list.splice(from, 1); list.splice(to, 0, item); commit(() => ({ pages: list })); setDraggedId(''); };

  const exportProject = () => {
    const bundle = { id: projectId, name: projectName, settings, pages, status };
    const blob = new Blob([JSON.stringify(bundle)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `${projectName || 'catalog'}.json`; anchor.click();
    URL.revokeObjectURL(url);
    saveMessage('تم تصدير ملف المشروع');
  };
  const importProject = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const incoming = JSON.parse(String(reader.result)) as { name?: string; settings: Record<string, string | boolean>; pages: CatalogPage[] };
        const normalized = normalizeProjectData({ settings: incoming.settings, pages: incoming.pages });
        if (!normalized.pages.length) throw new Error('invalid');
        const id = uid();
        await api('/api/projects', { method: 'POST', body: JSON.stringify({ id, name: incoming.name || 'مشروع مستورد', data: normalized }) });
        await openProjectById(id);
        saveMessage('تم استيراد المشروع');
      } catch { saveMessage('تعذر قراءة ملف المشروع'); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };
  const print = () => { setShowPrint(true); window.setTimeout(() => { window.print(); window.setTimeout(() => setShowPrint(false), 500); }, 80); };
  const createNew = () => { if (!window.confirm('إنشاء مشروع جديد؟ سيتم حفظ المشروع الحالي تلقائيًا.')) return; void createNewProject(); };
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; };

  const updateSetting = (key: string, value: string | boolean) => setSettings(current => ({ ...current, [key]: value }));
  const addRow = () => updatePage(page => ({ ...page, rows: [...page.rows, { id: uid(), label: 'حقل جديد', value: '', visible: true }] }));
  const updateRow = (id: string, key: keyof ProductRow, value: string | boolean) => updatePage(page => ({ ...page, rows: page.rows.map(row => row.id === id ? { ...row, [key]: value } : row) }));
  const deleteRow = (id: string) => updatePage(page => ({ ...page, rows: page.rows.filter(row => row.id !== id) }));
  const addSample = () => updatePage(page => ({ ...page, samples: [...page.samples, { id: uid(), name: 'عينة جديدة', supplier: '', code: '', color: '', use: '', quantity: '1', notes: '', swatch: '#c9b18a' }] }));
  const updateSample = (id: string, key: keyof MaterialSample, value: string) => updatePage(page => ({ ...page, samples: page.samples.map(sample => sample.id === id ? { ...sample, [key]: value } : sample) }));
  const deleteSample = (id: string) => updatePage(page => ({ ...page, samples: page.samples.filter(sample => sample.id !== id) }));

  if (!selected) return <div className="auth-shell" dir="rtl"><p className="auth-hint">جارٍ تحميل المشروع...</p></div>;

  return <div className="app-shell" dir="rtl">
    <header className="topbar no-print">
      <div className="brand"><div className="brand-mark"><Sparkles size={16} /></div><div><strong>محرّر <em>أوميرا</em></strong><span>كتالوجات الأثاث والمواصفات</span></div></div>
      <div className="project-name"><Pencil size={14} /><input value={projectName} onChange={e => setProjectName(e.target.value)} /><span className="saved"><span className="status-dot" /> محفوظ تلقائيًا</span></div>
      <div className="top-actions">
        <IconButton label="مشروع جديد" onClick={createNew}><FilePlus2 size={17} /></IconButton>
        <IconButton label="المشاريع الأخيرة" onClick={() => setShowProjects(true)}><LayoutTemplate size={17} /></IconButton>
        <span className="separator" />
        <IconButton label="تراجع" onClick={undo}><Undo2 size={17} /></IconButton>
        <IconButton label="إعادة" onClick={redo}><Redo2 size={17} /></IconButton>
        <span className="separator" />
        <button className={`outline-button approval-toggle-btn ${status ? `status-${status.status}` : ''} ${status && isFactoryVisible(status.status) ? 'is-approved' : ''}`} onClick={() => setShowApproval(true)}>
          {status && isFactoryVisible(status.status) ? <BadgeCheck size={16} /> : <ShieldCheck size={16} />} {status ? STATUS_LABELS[status.status] : 'الاعتماد وبيانات العميل'}
        </button>
        <button className="outline-button" onClick={() => setShowSettings(true)}><Settings size={16} /> إعدادات الهوية</button>
        <button className="outline-button" onClick={() => setShowAccounts(true)}><Users size={16} /> الحسابات</button>
        <NotificationsBell projects={allProjects} onOpen={(id) => { void openProjectById(id); }} />
        <IconButton label="المعاينة والطباعة" onClick={print}><Printer size={17} /></IconButton>
        <button className="primary-button" onClick={print}><Download size={16} /> حفظ PDF</button>
        <button className="more-button" aria-label="تصدير نسخة احتياطية" title="تصدير JSON" onClick={exportProject}><FileJson size={18} /></button>
        <span className="separator" />
        <div className="user-chip" title={user.username}>{user.displayName}</div>
        <IconButton label="تسجيل الخروج" onClick={logout}><LogOut size={16} /></IconButton>
      </div>
    </header>
    <div className="workspace">
      <aside className={`pages-panel no-print ${sidebarOpen ? '' : 'collapsed'}`}>
        <div className="panel-heading"><div><span className="eyebrow">المستند</span><h2>صفحات الكتالوج</h2></div><IconButton label="إخفاء قائمة الصفحات" onClick={() => setSidebarOpen(false)}><X size={17} /></IconButton></div>
        <div className="page-count"><span>{pages.length} صفحات</span><button onClick={() => setShowTemplates(true)}><Plus size={14} /> إضافة</button></div>
        <div className="page-list">{pages.map((page, index) => <div key={page.id} draggable onDragStart={() => setDraggedId(page.id)} onDragOver={e => e.preventDefault()} onDrop={e => dropPage(e, page.id)} className={`page-item ${selected.id === page.id ? 'selected' : ''} ${page.hidden ? 'is-hidden' : ''}`} onClick={() => setSelectedId(page.id)}><GripVertical className="drag" size={14} /><div className={`thumb thumb-${page.kind}`}><Thumb page={page} /></div><div className="page-meta"><strong>{index + 1}. {page.title}</strong><small>{pageNames[page.kind]}</small></div><button className="tiny-menu" onClick={e => { e.stopPropagation(); toggleHidden(page.id); }} title={page.hidden ? 'إظهار الصفحة' : 'إخفاء الصفحة'}><Eye size={13} /></button></div>)}</div>
        <div className="page-footer"><button className="add-page-button" onClick={() => setShowTemplates(true)}><Plus size={16} /> صفحة جديدة</button><button className="template-button" onClick={() => setShowSettings(true)}><Palette size={15} /> القوالب والهوية</button></div>
      </aside>
      {!sidebarOpen && <button className="panel-reopen left desktop-reopen no-print" aria-label="إظهار قائمة الصفحات" title="إظهار قائمة الصفحات" onClick={() => setSidebarOpen(true)}><Menu size={16} /></button>}
      <main className="canvas-area">
        <div className="canvas-toolbar no-print"><div className="breadcrumb">المشروع / <strong>{selected.title}</strong></div><div className="canvas-actions"><button onClick={() => setZoom(value => Math.max(42, value - 8))}><ZoomOut size={15} /></button><span>{zoom}%</span><button onClick={() => setZoom(value => Math.min(120, value + 8))}><ZoomIn size={15} /></button><span className="toolbar-separator" /><IconButton label="نسخ الصفحة" onClick={duplicatePage}><Copy size={16} /></IconButton><IconButton label="حذف الصفحة" onClick={deletePage}><Trash2 size={16} /></IconButton></div></div>
        <div className="canvas-scroll"><div className="page-stage" style={{ transform: `scale(${zoom / 72})` }}>
          <CatalogPageView page={selected} pageNumber={pages.findIndex(page => page.id === selected.id) + 1} settings={settings}
            callbacks={{
              onField: updateField,
              onUpload: (file, key) => uploadImage(file, data => updatePage(page => key.startsWith('sample-') ? { ...page, samples: page.samples.map(sample => sample.id === key.replace('sample-', '') ? { ...sample, image: data } : sample) } : ({ ...page, image: key === 'page' ? data : page.image, fields: { ...page.fields, [key]: data } }))),
              onRemoveImage: (key) => updatePage(page => key.startsWith('sample-') ? { ...page, samples: page.samples.map(sample => sample.id === key.replace('sample-', '') ? { ...sample, image: undefined } : sample) } : ({ ...page, image: key === 'page' ? undefined : page.image, fields: { ...page.fields, [key]: '' } })),
              onUpdateRow: updateRow,
              onUpdateSample: updateSample,
            }} />
        </div></div>
        <div className="canvas-status no-print"><span><span className="status-dot" /> كل التغييرات محفوظة على الخادم</span><span>صفحة {Math.max(1, pages.findIndex(page => page.id === selected.id) + 1)} من {visiblePages.length}</span></div>
      </main>
      <aside className={`inspector no-print ${inspectorOpen ? '' : 'collapsed'}`}>
        <div className="inspector-head"><div><span className="eyebrow">المحتوى</span><h2>خصائص الصفحة</h2></div><IconButton label="إخفاء لوحة الخصائص" onClick={() => setInspectorOpen(false)}><X size={17} /></IconButton></div>
        <div className="inspector-body"><Field label="اسم الصفحة" value={selected.title} onChange={value => updatePage(page => ({ ...page, title: value }))} /><div className="two-fields"><Field label="رقم اللوحة" value={String(pages.findIndex(page => page.id === selected.id) + 1).padStart(2, '0')} onChange={() => undefined} /><label className="field"><span>نوع الصفحة</span><select value={selected.kind} onChange={e => updatePage(page => ({ ...page, kind: e.target.value as PageKind }))}>{Object.entries(pageNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label></div><div className="divider" /><p className="section-label">إجراءات الصفحة</p><div className="inspector-actions"><button onClick={() => movePage(-1)}><ArrowUp size={15} /> تحريك لأعلى</button><button onClick={() => movePage(1)}><ArrowDown size={15} /> تحريك لأسفل</button><button onClick={duplicatePage}><Copy size={15} /> نسخ الصفحة</button><button onClick={() => toggleHidden(selected.id)}><Eye size={15} /> {selected.hidden ? 'إظهار في التصدير' : 'إخفاء من التصدير'}</button></div><div className="divider" /><p className="section-label">محتوى الصفحة</p><PageInspector page={selected} updateField={updateField} updatePage={updatePage} uploadImage={uploadImage} addRow={addRow} deleteRow={deleteRow} addSample={addSample} deleteSample={deleteSample} updateSample={updateSample} /></div>
      </aside>
      {!inspectorOpen && <button className="panel-reopen right desktop-reopen no-print" onClick={() => setInspectorOpen(true)}><Menu size={16} /></button>}
    </div>
    <div className="mobile-nav no-print"><button onClick={() => setSidebarOpen(true)}><Menu size={18} /> الصفحات</button><button onClick={() => setShowSettings(true)}><Settings size={18} /> الهوية</button><button onClick={print}><Printer size={18} /> طباعة</button></div>
    {showSettings && <SettingsModal settings={settings} onChange={updateSetting} onClose={() => setShowSettings(false)} onExport={exportProject} onImport={() => importRef.current?.click()} />}
    {showTemplates && <TemplateModal onPick={addPage} onClose={() => setShowTemplates(false)} />}
    {showProjects && <ProjectsModal currentId={projectId} onClose={() => setShowProjects(false)} onOpen={async (id) => { await openProjectById(id); setShowProjects(false); saveMessage('تم فتح المشروع'); }} />}
    {showApproval && status && <StatusModal projectId={projectId} status={status} pages={pages} onClose={() => setShowApproval(false)} onClientNameChange={(value) => updatePage2ByKind('cover', page => ({ ...page, fields: { ...page.fields, client: value } }), pages, commit)} onUpdated={(next) => { setStatus(next); refreshProjectsList(); }} />}
    {showAccounts && <AccountsModal onClose={() => setShowAccounts(false)} />}
    {showPrint && <div className="print-only-stage">{pages.filter(page => !page.hidden).map((page, index) => <CatalogPageView key={page.id} page={page} pageNumber={index + 1} settings={settings} readOnly />)}</div>}
    <div className="print-all-pages no-print" aria-hidden style={{ display: 'none' }}>{pages.filter(page => !page.hidden).map((page, index) => <div key={page.id} className="print-page-wrapper"><CatalogPageView page={page} pageNumber={index + 1} settings={settings} readOnly /></div>)}</div>
    <input ref={importRef} type="file" accept="application/json" hidden onChange={importProject} />
    {toast && <div className="toast"><span className="status-dot" /> {toast}</div>}
  </div>;
}

// مساعد بسيط لتحديث حقل داخل صفحة الغلاف تحديدًا (لربط اسم العميل بلوحة الاعتماد)
function updatePage2ByKind(kind: PageKind, updater: (page: CatalogPage) => CatalogPage, pages: CatalogPage[], commit: (updater: (current: { pages: CatalogPage[] }) => { pages: CatalogPage[] }) => void) {
  const target = pages.find(p => p.kind === kind);
  if (!target) return;
  commit(current => ({ pages: current.pages.map(page => page.id === target.id ? updater(page) : page) }));
}

/* ---------------- لوحة مراحل المشروع وبيانات العميل ---------------- */

function activityLine(entry: ActivityEntry): string {
  const who = entry.userDisplayName || 'النظام';
  if (entry.action === 'created') return `${who} أنشأ المشروع`;
  if (entry.action === 'status_changed') return `${who} غيّر المرحلة ${entry.details ?? ''}`;
  if (entry.action === 'progress_updated') return `${who} حدّث نسبة الإنجاز إلى ${entry.details ?? ''}`;
  return `${who} — ${entry.action}`;
}

function ActivityLog({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  useEffect(() => {
    if (!projectId) return;
    api<{ activity: ActivityEntry[] }>(`/api/projects/${projectId}/activity`).then(d => setItems(d.activity)).catch(() => undefined);
  }, [projectId]);
  if (items.length === 0) return <p className="empty-state">لا يوجد نشاط مسجَّل بعد.</p>;
  return <div className="activity-list">{items.map(entry => <div className="activity-row" key={entry.id}><span>{activityLine(entry)}</span><small>{new Date(entry.createdAt).toLocaleString('ar-SA')}</small></div>)}</div>;
}

function StatusModal({ projectId, status, pages, onClose, onClientNameChange, onUpdated }: {
  projectId: string; status: ProjectSummary; pages: CatalogPage[]; onClose: () => void;
  onClientNameChange: (value: string) => void; onUpdated: (next: ProjectSummary) => void;
}) {
  const coverPage = pages.find(p => p.kind === 'cover');
  const [clientName, setClientName] = useState(coverPage?.fields.client ?? status.clientName ?? '');
  const [stage, setStage] = useState<ProjectStatus>(status.status);
  const [startDate, setStartDate] = useState(status.startDate ?? '');
  const [dueDate, setDueDate] = useState(status.dueDate ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requiresDates = stage !== 'draft' && stage !== 'review';

  const save = async () => {
    setError('');
    if (requiresDates && (!startDate || !dueDate)) {
      setError('حدد تاريخ البداية وتاريخ التسليم المتوقع عند الاعتماد أو ما بعده');
      return;
    }
    setBusy(true);
    try {
      onClientNameChange(clientName);
      const data = await api<{ project: ProjectSummary }>(`/api/projects/${projectId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: stage, startDate, dueDate }),
      });
      onUpdated({ ...status, ...data.project });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الحفظ');
    } finally {
      setBusy(false);
    }
  };

  return <div className="modal-backdrop no-print" onClick={onClose}><div className="modal approval-modal" onClick={e => e.stopPropagation()}>
    <div className="modal-head"><div><span className="eyebrow">إدارة المشروع</span><h2>مرحلة المشروع وبيانات العميل</h2></div><button onClick={onClose}><X size={19} /></button></div>
    <div className="approval-body">
      {!coverPage && <p className="approval-warning">لا توجد صفحة غلاف في هذا المشروع بعد — أضف صفحة غلاف حتى يظهر اسم العميل في المقدمة.</p>}
      <Field label="اسم العميل (مرتبط بصفحة الغلاف)" value={clientName} onChange={setClientName} />
      <p className="section-label">مرحلة المشروع</p>
      <div className="status-stepper">
        {PROJECT_STATUSES.map((value, index) => <button key={value} type="button" className={`status-step ${stage === value ? 'active' : ''} ${PROJECT_STATUSES.indexOf(stage) >= index ? 'passed' : ''}`} onClick={() => setStage(value)}>
          <span className="status-step-dot">{index + 1}</span><span>{STATUS_LABELS[value]}</span>
        </button>)}
      </div>
      <p className="approval-hint">يمكنك الرجوع لمرحلة سابقة في أي وقت — سيختفي المشروع من شاشة المصنع تلقائيًا قبل مرحلة "معتمد"، وتبقى كل بياناته محفوظة.</p>
      <div className="two-fields">
        <label className="field"><span>تاريخ البداية</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={!requiresDates} /></label>
        <label className="field"><span>تاريخ التسليم المتوقع</span><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={!requiresDates} /></label>
      </div>
      <div className="approval-progress-readout">
        <span>نسبة الإنجاز الحالية (يحدّثها المصنع)</span>
        <div className="progress-bar"><div className="progress-fill" style={{ width: `${status.completionPercent}%` }} /></div>
        <strong>{status.completionPercent}%</strong>
      </div>
      {error && <p className="auth-error">{error}</p>}
      <div className="divider" />
      <p className="section-label">سجل النشاط</p>
      <ActivityLog projectId={projectId} />
    </div>
    <div className="modal-foot"><span className="approval-hint">{status.statusUpdatedAt ? `آخر تحديث للمرحلة: ${new Date(status.statusUpdatedAt).toLocaleString('ar-SA')}` : 'لم تُحدَّث المرحلة بعد'}</span><button className="primary-button" disabled={busy} onClick={save}>{busy ? 'جارٍ الحفظ...' : 'حفظ'}</button></div>
  </div></div>;
}

/* ---------------- إدارة الحسابات ---------------- */

function AccountsModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<{ id: number; username: string; displayName: string; role: string }[]>([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'engineer' | 'factory'>('factory');
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
        {list.map(item => <div className="account-row" key={item.id}><span className={`role-pill ${item.role}`}>{item.role === 'engineer' ? 'مهندس' : 'مصنع'}</span><div><strong>{item.displayName}</strong><small>{item.username}</small></div><button className="icon-button" onClick={() => remove(item.id)}><Trash2 size={15} /></button></div>)}
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
        <label className="field"><span>نوع الحساب</span><select value={role} onChange={e => setRole(e.target.value as 'engineer' | 'factory')}><option value="factory">مصنع</option><option value="engineer">مهندس</option></select></label>
      </div>
      {error && <p className="auth-error">{error}</p>}
      <button className="add-page-button wide" disabled={busy} onClick={create}><UserPlus size={15} /> إنشاء الحساب</button>
    </div>
  </div></div>;
}

/* ---------------- بقية النوافذ (كما في النسخة الأصلية) ---------------- */

function SettingsModal({ settings, onChange, onClose, onExport, onImport }: { settings: Record<string, string | boolean>; onChange: (key: string, value: string | boolean) => void; onClose: () => void; onExport: () => void; onImport: () => void }) {
  const logoInput = useRef<HTMLInputElement>(null);
  return <div className="modal-backdrop no-print" onClick={onClose}><div className="modal settings-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">إعدادات المشروع</span><h2>الهوية والبيانات العامة</h2></div><button onClick={onClose}><X size={19} /></button></div><div className="settings-grid"><div className="settings-brand"><div className="large-logo"><img src={String(settings.logo || logoPath)} alt="شعار الشركة" /></div><button className="outline-button" onClick={() => logoInput.current?.click()}><Upload size={15} /> تغيير الشعار</button><input ref={logoInput} hidden type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => onChange('logo', String(reader.result)); reader.readAsDataURL(file); }} /><p>يظهر الشعار تلقائيًا في الغلاف وتذييل الصفحات.</p></div><div className="settings-fields"><Field label="اسم الشركة بالعربية" value={String(settings.companyAr)} onChange={value => onChange('companyAr', value)} /><Field label="اسم الشركة بالإنجليزية" value={String(settings.companyEn)} onChange={value => onChange('companyEn', value)} /><Field label="بيان الشريك التنفيذي" value={String(settings.partner)} onChange={value => onChange('partner', value)} /><div className="two-fields"><Field label="الهاتف الأول" value={String(settings.phone)} onChange={value => onChange('phone', value)} /><Field label="الهاتف الثاني" value={String(settings.phoneAlt)} onChange={value => onChange('phoneAlt', value)} /></div><div className="two-fields"><Field label="البريد الإلكتروني" value={String(settings.email)} onChange={value => onChange('email', value)} /><Field label="إنستغرام" value={String(settings.instagram)} onChange={value => onChange('instagram', value)} /></div><Field label="الموقع الإلكتروني" value={String(settings.website)} onChange={value => onChange('website', value)} /><Field label="العنوان" value={String(settings.address)} onChange={value => onChange('address', value)} /><Field label="العبارة التعريفية" value={String(settings.tagline)} onChange={value => onChange('tagline', value)} /><Field label="بيانات التذييل" value={String(settings.footer)} onChange={value => onChange('footer', value)} /><div className="color-fields"><label>اللون الأساسي <input type="color" value={String(settings.primary)} onChange={e => onChange('primary', e.target.value)} /></label><label>اللون الثانوي <input type="color" value={String(settings.secondary)} onChange={e => onChange('secondary', e.target.value)} /></label></div><label className="check-field"><input type="checkbox" checked={Boolean(settings.showNumbers)} onChange={e => onChange('showNumbers', e.target.checked)} /> إظهار أرقام الصفحات</label><label className="check-field"><input type="checkbox" checked={Boolean(settings.watermark)} onChange={e => onChange('watermark', e.target.checked)} /> إظهار علامة مائية خفيفة</label></div></div><div className="modal-foot"><div><button className="outline-button" onClick={onImport}><Import size={15} /> استيراد مشروع</button><button className="outline-button" onClick={onExport}><FileJson size={15} /> تصدير JSON</button></div><button className="primary-button" onClick={onClose}>حفظ وإغلاق</button></div></div></div>;
}

function TemplateModal({ onPick, onClose }: { onPick: (kind: PageKind) => void; onClose: () => void }) {
  const kinds: PageKind[] = ['cover', 'product', 'technical', 'materials', 'plan', 'free'];
  const icons: Record<PageKind, string> = { cover: '⌂', product: '◇', technical: '⌗', materials: '●', plan: '⌘', free: '✎' };
  return <div className="modal-backdrop no-print" onClick={onClose}><div className="modal template-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">إضافة صفحة</span><h2>اختر نوع الصفحة</h2></div><button onClick={onClose}><X size={19} /></button></div><div className="template-grid">{kinds.map(kind => <button key={kind} className="template-card" onClick={() => onPick(kind)}><div className="template-card-icon">{icons[kind]}</div><strong>{pageNames[kind]}</strong><small>{kind === 'cover' ? 'غلاف الكتالوج والمقدمة' : kind === 'product' ? 'مواصفات قطعة أثاث كاملة' : kind === 'technical' ? 'رسم فني ومقاسات' : kind === 'materials' ? 'عينات الأقمشة والخامات' : kind === 'plan' ? 'مخطط توزيع الأثاث' : 'صفحة حرة بمحتوى مخصص'}</small></button>)}</div></div></div>;
}

function ProjectsModal({ currentId, onClose, onOpen }: { currentId: string; onClose: () => void; onOpen: (id: string) => void }) {
  const [items, setItems] = useState<{ id: string; name: string; updatedAt: string; clientName: string; status: ProjectStatus }[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => { api<{ projects: typeof items }>('/api/projects').then(d => setItems(d.projects)).catch(() => undefined); }, []);
  const filtered = items.filter(item => item.name.toLowerCase().includes(query.toLowerCase()) || (item.clientName || '').toLowerCase().includes(query.toLowerCase()));
  return <div className="modal-backdrop no-print" onClick={onClose}><div className="modal projects-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">مساحة العمل</span><h2>المشاريع الأخيرة</h2></div><button onClick={onClose}><X size={19} /></button></div><div className="project-search"><Search size={16} /><input placeholder="ابحث باسم المشروع أو العميل..." value={query} onChange={e => setQuery(e.target.value)} />{query && <button onClick={() => setQuery('')}><X size={14} /></button>}</div><div className="project-list">{filtered.map((item, index) => <button className={`project-card ${item.id === currentId ? 'current' : ''}`} key={item.id} onClick={() => onOpen(item.id)}><div className="project-card-number">{String(index + 1).padStart(2, '0')}</div><div className="project-card-icon"><LayoutTemplate size={19} /></div><div><strong>{item.name}</strong><span>{item.clientName ? `${item.clientName} · ` : ''}{new Date(item.updatedAt).toLocaleDateString('ar-SA')} · {STATUS_LABELS[item.status]}</span></div><ChevronLeft size={16} /></button>)}{filtered.length === 0 && <div className="empty-state">لا توجد مشاريع مطابقة لبحثك.</div>}</div></div></div>;
}

function PageInspector({ page, updateField, updatePage, uploadImage, addRow, deleteRow, addSample, deleteSample, updateSample }: { page: CatalogPage; updateField: (key: string, value: string) => void; updatePage: (updater: (page: CatalogPage) => CatalogPage) => void; uploadImage: (file: File, callback: (data: string) => void) => void; addRow: () => void; deleteRow: (id: string) => void; addSample: () => void; deleteSample: (id: string) => void; updateSample: (id: string, key: keyof MaterialSample, value: string) => void }) {
  const moveRow = (id: string, direction: -1 | 1) => updatePage(current => { const rows = [...current.rows]; const index = rows.findIndex(row => row.id === id); const next = index + direction; if (index < 0 || next < 0 || next >= rows.length) return current; [rows[index], rows[next]] = [rows[next], rows[index]]; return { ...current, rows }; });
  const moveSample = (id: string, direction: -1 | 1) => updatePage(current => { const samples = [...current.samples]; const index = samples.findIndex(sample => sample.id === id); const next = index + direction; if (index < 0 || next < 0 || next >= samples.length) return current; [samples[index], samples[next]] = [samples[next], samples[index]]; return { ...current, samples }; });
  const visible = (key: string) => isFieldVisible(page, key);
  const toggle = (key: string) => updatePage(current => { const hiddenFields = new Set(current.hiddenFields ?? []); if (hiddenFields.has(key)) hiddenFields.delete(key); else hiddenFields.add(key); return { ...current, hiddenFields: [...hiddenFields] }; });
  const editableField = (key: string, label: string, multiline = false) => <Field key={key} label={label} value={page.fields[key] || ''} onChange={value => updateField(key, value)} multiline={multiline} />;
  const pageImageEditor = (label: string) => <div className="inspector-image"><div className="field-label-row image-label-row"><span>{label}</span></div><ImagePlaceholder image={page.image} label="رفع صورة" onUpload={file => uploadImage(file, data => updatePage(current => ({ ...current, image: data })))} onRemove={() => updatePage(current => ({ ...current, image: undefined }))} /></div>;

  if (page.kind === 'cover') return <div className="inspector-fields">
    {editableField('companyAr', 'اسم الشركة بالعربية')}{editableField('companyEn', 'اسم الشركة بالإنجليزية')}{editableField('project', 'اسم المشروع')}{editableField('intro', 'المقدمة', true)}
    <div className="two-fields">{editableField('client', 'العميل')}{editableField('location', 'الموقع')}</div><div className="two-fields">{editableField('date', 'تاريخ الإصدار')}{editableField('designer', 'إعداد وتصميم')}</div>
    {editableField('contact', 'سطر معلومات التواصل')}
    <p className="section-label visibility-heading">إظهار بيانات التواصل</p>
    <div className="visibility-grid">{['phone', 'instagram', 'email', 'website', 'address', 'tagline', 'logo'].map(key => <button key={key} className={`visibility-row ${visible(key) ? '' : 'is-hidden'}`} onClick={() => toggle(key)}><span>{{ phone: 'الهاتف', instagram: 'إنستغرام', email: 'البريد الإلكتروني', website: 'الموقع الإلكتروني', address: 'العنوان', tagline: 'العبارة التعريفية', logo: 'شعار الغلاف' }[key]}</span><Eye size={13} /></button>)}</div>
    {pageImageEditor('صورة الغلاف')}
  </div>;
  if (page.kind === 'product') return <div className="inspector-fields">
    {editableField('section', 'القسم أو الفراغ')}{editableField('product', 'اسم القطعة')}
    <div className="two-fields">{editableField('quantity', 'الكمية')}{editableField('catalog', 'رقم الكتالوج')}</div><div className="two-fields">{editableField('supplier', 'المورد')}{editableField('finish', 'التشطيب أو الدهان')}</div>
    {editableField('notes', 'ملاحظات الاعتماد', true)}{pageImageEditor('الصورة الرئيسية')}
    <p className="section-label row-header">صفوف جدول المواصفات <button onClick={addRow}><Plus size={14} /> إضافة صف</button></p>
    {page.rows.map(row => <div className="row-editor" key={row.id}><div className="row-editor-title"><label className="row-visible"><input type="checkbox" checked={row.visible} onChange={e => updatePage(current => ({ ...current, rows: current.rows.map(item => item.id === row.id ? { ...item, visible: e.target.checked } : item) }))} /> ظاهر</label><input value={row.label} onChange={e => updatePage(current => ({ ...current, rows: current.rows.map(item => item.id === row.id ? { ...item, label: e.target.value } : item) }))} /><button title="تحريك لأعلى" onClick={() => moveRow(row.id, -1)}><ArrowUp size={13} /></button><button title="تحريك لأسفل" onClick={() => moveRow(row.id, 1)}><ArrowDown size={13} /></button><button title="حذف الصف" onClick={() => deleteRow(row.id)}><Trash2 size={13} /></button></div><textarea value={row.value} onChange={e => updatePage(current => ({ ...current, rows: current.rows.map(item => item.id === row.id ? { ...item, value: e.target.value } : item) }))} /></div>)}
  </div>;
  if (page.kind === 'materials') return <div className="inspector-fields">
    {editableField('section', 'عنوان اللوحة')}{editableField('description', 'وصف اللوحة', true)}
    <button className="add-page-button wide" onClick={addSample}><Plus size={15} /> إضافة عينة جديدة</button>
    {page.samples.map(sample => <div className="sample-editor" key={sample.id}><div className="row-editor-title"><strong>{sample.name}</strong><button title="تحريك لأعلى" onClick={() => moveSample(sample.id, -1)}><ArrowUp size={13} /></button><button title="تحريك لأسفل" onClick={() => moveSample(sample.id, 1)}><ArrowDown size={13} /></button><button title="حذف العينة" onClick={() => deleteSample(sample.id)}><Trash2 size={13} /></button></div>
      <div className="inspector-image compact"><ImagePlaceholder image={sample.image} label="رفع صورة" onUpload={file => uploadImage(file, data => updateSample(sample.id, 'image', data))} onRemove={() => updateSample(sample.id, 'image', '')} /></div>
      <Field label="اسم الخامة" value={sample.name} onChange={value => updateSample(sample.id, 'name', value)} />
      <div className="two-fields"><Field label="المورد" value={sample.supplier} onChange={value => updateSample(sample.id, 'supplier', value)} /><Field label="الكود" value={sample.code} onChange={value => updateSample(sample.id, 'code', value)} /></div>
      <div className="two-fields"><Field label="اللون" value={sample.color} onChange={value => updateSample(sample.id, 'color', value)} /><Field label="الاستخدام" value={sample.use} onChange={value => updateSample(sample.id, 'use', value)} /></div>
      <div className="two-fields"><Field label="الكمية" value={sample.quantity} onChange={value => updateSample(sample.id, 'quantity', value)} /><label className="field"><span>لون الرمز</span><input className="swatch-input" type="color" value={sample.swatch} onChange={e => updateSample(sample.id, 'swatch', e.target.value)} /></label></div>
      <Field label="ملاحظات" value={sample.notes} onChange={value => updateSample(sample.id, 'notes', value)} multiline />
    </div>)}
  </div>;
  const fieldLabels: Record<PageKind, Array<[string, string]>> = { technical: [['drawingTitle', 'عنوان الرسم'], ['description', 'الوصف الفني'], ['scale', 'مقياس الرسم'], ['board', 'رقم اللوحة'], ['notes', 'ملاحظات']], plan: [['room', 'عنوان الفراغ'], ['description', 'وصف المخطط'], ['legend', 'مفتاح الألوان والخامات'], ['notes', 'ملاحظات المقاسات']], free: [['heading', 'العنوان'], ['body', 'النص'], ['notes', 'الملاحظات']], cover: [], product: [], materials: [] };
  return <div className="inspector-fields">{fieldLabels[page.kind].map(([key, label]) => editableField(key, label, ['description', 'notes', 'body', 'legend'].includes(key)))}{pageImageEditor('صورة الصفحة')}</div>;
}
