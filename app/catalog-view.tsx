import { ChangeEvent, useRef } from 'react';
import { Globe2, ImagePlus, Instagram, Mail, MapPin, Phone, X } from 'lucide-react';
import { CatalogPage, MaterialSample, ProductRow, imageSrc, isFieldVisible, logoPath, updatedCoverPath, updatedMaterialsPath, updatedPlanPath, updatedProductCardPath } from './catalog-types';

export function Field({ label, value, onChange, multiline = false, readOnly = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; readOnly?: boolean }) {
  return <label className="field"><span className="field-label-row"><span>{label}</span></span>{multiline ? <textarea value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} /> : <input value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} />}</label>;
}

export function ImagePlaceholder({ image, label, onUpload, onRemove, readOnly = false }: { image?: string; label: string; onUpload: (file: File) => void; onRemove: () => void; readOnly?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ''; };
  return <div className={`image-placeholder ${image ? 'has-image' : ''} ${readOnly ? 'read-only' : ''}`} onClick={() => !readOnly && inputRef.current?.click()}>
    {image ? <img src={imageSrc(image)} alt="" /> : <><ImagePlus size={24} /><strong>{label}</strong>{!readOnly && <small>اضغط لرفع صورة أو استبدالها</small>}</>}
    {!readOnly && <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />}
    {image && !readOnly && <button className="image-remove" onClick={e => { e.stopPropagation(); onRemove(); }} aria-label="حذف الصورة"><X size={14} /></button>}
  </div>;
}

function ContactItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="contact-item"><span className="contact-icon">{icon}</span><span><b>{label}</b><em>{value}</em></span></div>;
}

type PageCallbacks = {
  onField: (key: string, value: string) => void;
  onUpload: (file: File, key: string) => void;
  onRemoveImage: (key: string) => void;
  onUpdateRow: (id: string, key: keyof ProductRow, value: string | boolean) => void;
  onUpdateSample: (id: string, key: keyof MaterialSample, value: string) => void;
};

export const noopCallbacks: PageCallbacks = {
  onField: () => undefined,
  onUpload: () => undefined,
  onRemoveImage: () => undefined,
  onUpdateRow: () => undefined,
  onUpdateSample: () => undefined,
};

// الغلاف المحدث: تصميم العميل نفسه صورةً بدقة الطباعة، وفوقه حقول شفافة
// في مواضعها المقاسة من الملف الأصلي (نِسَب من مقاس A4). لا يُعاد رسم أي
// عنصر من التصميم، فلا يتغير فيه شيء.
// بطاقة المنتج المحدثة: تصميم العميل نفسه صورةً بدقة الطباعة، وفوقه منطقة
// رفع صورة المنتج وسبعة حقول في مواضعها المقاسة من الملف الأصلي.
// الخط Cairo بحجم أكبر قليلًا من الغلاف لوضوح القراءة.
// ملف الخامات المحدث: تصميم العميل نفسه صورةً بدقة الطباعة، وفوقه ثلاث
// كتل — لكل كتلة صورة خامة وحقلا الكود والمورد — في مواضعها المقاسة من
// الملف الأصلي. يُعاد استخدام نموذج العيّنات القائم (samples).
const MATERIAL_BLOCKS = [
  { image: { top: '8.11%', height: '27.83%' }, code: { top: '13.80%', height: '6.33%' }, supplier: { top: '22.36%', height: '6.33%' } },
  { image: { top: '37.70%', height: '27.83%' }, code: { top: '43.03%', height: '6.33%' }, supplier: { top: '51.58%', height: '6.33%' } },
  { image: { top: '68.14%', height: '27.83%' }, code: { top: '73.94%', height: '6.33%' }, supplier: { top: '82.52%', height: '6.30%' } },
] as const;
const MAT_IMAGE_X = { right: '46.75%', width: '50.02%' };
const MAT_FIELD_X = { right: '11.71%', width: '33.81%' };

// صفحة المخطط المحدثة: تصميم العميل نفسه صورةً بدقة الطباعة، وفوقه إطار
// واحد يرفع فيه المخطط — بمقاسه المقيس من الملف الأصلي.
function UpdatedPlanPage({ page, cb, readOnly }: { page: CatalogPage; cb: PageCallbacks; readOnly: boolean }) {
  return <div className="uplan-layout">
    <img className="uplan-art" src={updatedPlanPath} alt="" />
    <div className="uplan-image" style={{ top: '8.70%', height: '80.89%', right: '1.94%', width: '96.12%' }}>
      <ImagePlaceholder image={page.image} label="اضغط لرفع الرسم أو المخطط" readOnly={readOnly}
        onUpload={file => cb.onUpload(file, 'page')} onRemove={() => cb.onRemoveImage('page')} />
    </div>
  </div>;
}

function UpdatedMaterialsPage({ page, cb, readOnly }: { page: CatalogPage; cb: PageCallbacks; readOnly: boolean }) {
  const samples = page.samples.slice(0, MATERIAL_BLOCKS.length);
  return <div className="mfile-layout">
    <img className="mfile-art" src={updatedMaterialsPath} alt="" />
    {MATERIAL_BLOCKS.map((block, index) => {
      const sample = samples[index];
      if (!sample) return null;
      return <div key={sample.id}>
        <div className="mfile-image" style={{ ...MAT_IMAGE_X, ...block.image }}>
          <ImagePlaceholder image={sample.image} label="اضغط لرفع صورة الخامة" readOnly={readOnly}
            onUpload={file => cb.onUpload(file, `sample-${sample.id}`)} onRemove={() => cb.onRemoveImage(`sample-${sample.id}`)} />
        </div>
        <div className="mfile-field" style={{ ...MAT_FIELD_X, ...block.code }}>
          <input className="mfile-input" readOnly={readOnly} value={sample.code}
            onChange={e => cb.onUpdateSample(sample.id, 'code', e.target.value)} />
        </div>
        <div className="mfile-field" style={{ ...MAT_FIELD_X, ...block.supplier }}>
          <input className="mfile-input" readOnly={readOnly} value={sample.supplier}
            onChange={e => cb.onUpdateSample(sample.id, 'supplier', e.target.value)} />
        </div>
      </div>;
    })}
  </div>;
}

function UpdatedProductPage({ page, cb, readOnly }: { page: CatalogPage; cb: PageCallbacks; readOnly: boolean }) {
  const f = (key: string) => page.fields[key] ?? "";
  const cell = (key: string, extra?: string) => (
    <input
      className={`pcard-input ${extra ?? ""} ${f(key) ? "has-value" : ""}`}
      readOnly={readOnly}
      value={f(key)}
      onChange={(e) => cb.onField(key, e.target.value)}
    />
  );
  return <div className="pcard-layout">
    <img className="pcard-art" src={updatedProductCardPath} alt="" />
    {/* صورة المنتج تملأ الإطار المخصص لها في التصميم */}
    <div className="pcard-image" style={{ top: '13%', height: '40.72%', right: '9.44%', width: '80.64%' }}>
      <ImagePlaceholder image={page.image} label="اضغط لرفع صورة المنتج" readOnly={readOnly}
        onUpload={file => cb.onUpload(file, 'page')} onRemove={() => cb.onRemoveImage('page')} />
    </div>
    {/* الصف الأول: الوصف ثم العدد */}
    <div className="pcard-field" style={{ top: '56.20%', height: '6.33%', right: '29.07%', width: '28.31%' }}>{cell('description')}</div>
    <div className="pcard-field" style={{ top: '56.20%', height: '6.33%', right: '75.93%', width: '14.11%' }}>{cell('count')}</div>
    {/* الأبعاد: التصميم يطبع W/H/D كنموذج، فتُخفى خلف خلفية بيضاء عند الكتابة فقط */}
    <div className="pcard-field" style={{ top: '62.53%', height: '6.32%', right: '29.07%', width: '60.97%' }}>{cell('dimensions', 'pcard-cover-art')}</div>
    <div className="pcard-field" style={{ top: '68.85%', height: '6.33%', right: '29.07%', width: '60.97%' }}>{cell('fabric')}</div>
    <div className="pcard-field" style={{ top: '75.18%', height: '6.33%', right: '29.07%', width: '60.97%' }}>{cell('paint')}</div>
    <div className="pcard-field" style={{ top: '81.51%', height: '6.31%', right: '29.07%', width: '60.97%' }}>{cell('breem')}</div>
    <div className="pcard-field pcard-notes" style={{ top: '88.88%', height: '6.47%', right: '34%', width: '56.40%' }}>{cell('notes')}</div>
  </div>;
}

function UpdatedCoverPage({ page, cb, readOnly, clientNumber }: { page: CatalogPage; cb: PageCallbacks; readOnly: boolean; clientNumber?: number | null }) {
  const f = (key: string) => page.fields[key] ?? "";
  const cell = (key: string, placeholder: string) => (
    <input
      className="ucover-input"
      readOnly={readOnly}
      value={f(key)}
      placeholder={readOnly ? "" : placeholder}
      onChange={(e) => cb.onField(key, e.target.value)}
    />
  );
  return <div className="ucover-layout">
    <img className="ucover-art" src={updatedCoverPath} alt="" />
    {/* الصف الأول: رقم العميل (يمينًا) ونوع المشروع */}
    <div className="ucover-field" style={{ top: '27.35%', height: '4.10%', right: '29.40%', width: '14.43%' }}>
      {cell('clientNumber', clientNumber ? String(clientNumber) : '')}
    </div>
    <div className="ucover-field" style={{ top: '27.35%', height: '4.10%', right: '63.87%', width: '26.41%' }}>{cell('projectType', 'نوع المشروع')}</div>
    <div className="ucover-field" style={{ top: '32.99%', height: '4.11%', right: '29.52%', width: '60.76%' }}>{cell('clientName', 'اسم العميل')}</div>
    <div className="ucover-field" style={{ top: '38.61%', height: '4.10%', right: '29.52%', width: '60.76%' }}>{cell('mobile', 'رقم الجوال')}</div>
    <div className="ucover-field" style={{ top: '44.25%', height: '4.08%', right: '29.52%', width: '60.76%' }}>{cell('address', 'العنوان')}</div>
    <div className="ucover-field" style={{ top: '49.99%', height: '4.02%', right: '29.52%', width: '60.76%' }}>{cell('date', 'التاريخ')}</div>
    {/* اعتماد العميل — يسار التسمية المطبوعة */}
    <div className="ucover-field ucover-approval" style={{ top: '76.93%', height: '3.6%', right: '31.05%', width: '37.90%' }}>{cell('approval', '')}</div>
  </div>;
}

function CoverPage({ page, settings, cb, readOnly, clientNumber }: { page: CatalogPage; settings: Record<string, string | boolean>; cb: PageCallbacks; readOnly: boolean; clientNumber?: number | null }) {
  const show = (key: string) => isFieldVisible(page, key);
  const hasDetails = ['client', 'location', 'date', 'designer'].some(show);
  const hasContacts = ['phone', 'instagram', 'email', 'website', 'address'].some(key => show(key) && Boolean(settings[key]));
  return <div className="cover-layout"><div className="cover-copy">
    {show('companyAr') && <input className="cover-company" readOnly={readOnly} value={page.fields.companyAr} onChange={e => cb.onField('companyAr', e.target.value)} />}
    {show('companyEn') && <input className="cover-en" readOnly={readOnly} value={page.fields.companyEn} onChange={e => cb.onField('companyEn', e.target.value)} />}
    {(show('project') || show('intro')) && <span className="cover-rule" />}
    {show('project') && <input className="cover-project" readOnly={readOnly} value={page.fields.project} onChange={e => cb.onField('project', e.target.value)} />}
    {show('intro') && <textarea className="cover-intro" readOnly={readOnly} value={page.fields.intro} onChange={e => cb.onField('intro', e.target.value)} />}
    {hasDetails && <div className="cover-details">
      {show('client') && <div className="cover-client-field"><Field label="العميل" readOnly={readOnly} value={page.fields.client} onChange={value => cb.onField('client', value)} />{clientNumber ? <span className="cover-client-number">رقم العميل #{clientNumber}</span> : null}</div>}
      {show('location') && <Field label="الموقع" readOnly={readOnly} value={page.fields.location} onChange={value => cb.onField('location', value)} />}
      {show('date') && <Field label="تاريخ الإصدار" readOnly={readOnly} value={page.fields.date} onChange={value => cb.onField('date', value)} />}
      {show('designer') && <Field label="إعداد وتصميم" readOnly={readOnly} value={page.fields.designer} onChange={value => cb.onField('designer', value)} />}
    </div>}
    {show('contact') && <input className="cover-contact" readOnly={readOnly} value={page.fields.contact} onChange={e => cb.onField('contact', e.target.value)} />}
    {hasContacts && <div className="cover-contact-card">
      {show('phone') && Boolean(settings.phone) && <ContactItem icon={<Phone size={14} />} label="الهاتف" value={`${String(settings.phone)}${settings.phoneAlt ? ` • ${String(settings.phoneAlt)}` : ''}`} />}
      {show('instagram') && Boolean(settings.instagram) && <ContactItem icon={<Instagram size={14} />} label="إنستغرام" value={String(settings.instagram)} />}
      {show('email') && Boolean(settings.email) && <ContactItem icon={<Mail size={14} />} label="البريد الإلكتروني" value={String(settings.email)} />}
      {show('website') && Boolean(settings.website) && <ContactItem icon={<Globe2 size={14} />} label="الموقع الإلكتروني" value={String(settings.website)} />}
      {show('address') && Boolean(settings.address) && <ContactItem icon={<MapPin size={14} />} label="العنوان" value={String(settings.address)} />}
    </div>}
    {show('tagline') && <div className="cover-tagline">{String(settings.tagline)}</div>}
  </div><div className="cover-visual">
    {show('image') && <div className="cover-frame"><ImagePlaceholder image={page.image} label="صورة الغلاف" readOnly={readOnly} onUpload={file => cb.onUpload(file, 'page')} onRemove={() => cb.onRemoveImage('page')} /></div>}
    {show('logo') && <div className="cover-monogram"><img src={imageSrc(String(settings.logo || logoPath))} alt="شعار OMERA" /><span>CATALOGUE / 2026</span></div>}
  </div></div>;
}

function ProductPage({ page, cb, readOnly }: { page: CatalogPage; cb: PageCallbacks; readOnly: boolean }) {
  const show = (key: string) => isFieldVisible(page, key);
  return <div className="product-layout"><div className="page-heading">
    {show('section') && <span>{page.fields.section}</span>}
    {show('product') && <input readOnly={readOnly} value={page.fields.product} onChange={e => cb.onField('product', e.target.value)} />}
    {show('catalog') && <small>PRODUCT SPECIFICATION / {page.fields.catalog}</small>}
  </div>
  {show('image') && <div className="product-hero"><ImagePlaceholder image={page.image} label="صورة المنتج الرئيسية" readOnly={readOnly} onUpload={file => cb.onUpload(file, 'page')} onRemove={() => cb.onRemoveImage('page')} /></div>}
  {show('specTable') && <div className="editable-spec-table">{page.rows.filter(row => row.visible).map(row => <div className="spec-row" key={row.id}>
    <div className="spec-label-cell"><input className="spec-label" readOnly={readOnly} value={row.label} onChange={e => cb.onUpdateRow(row.id, 'label', e.target.value)} /></div>
    <div className="spec-value-cell">
      <div className="spec-value-grow" data-value={row.value}>
        <textarea className="spec-value" readOnly={readOnly} value={row.value} onChange={e => cb.onUpdateRow(row.id, 'value', e.target.value)} />
      </div>
      {(row.image || !readOnly) && <div className="spec-row-image"><ImagePlaceholder image={row.image} label="إضافة صورة" readOnly={readOnly} onUpload={file => cb.onUpload(file, `row-${row.id}`)} onRemove={() => cb.onRemoveImage(`row-${row.id}`)} /></div>}
    </div>
  </div>)}</div>}
  {show('notes') && <div className="approval-note"><span>ملاحظات الاعتماد</span><p>{page.fields.notes || '—'}</p></div>}
  </div>;
}

// صفحة رسم فني بملء الورقة: عنوان واحد قابل للتعديل أعلى، والصورة تأخذ
// كامل المساحة المتبقية حتى خط التذييل. الهوية والتذييل يبقيان.
function DrawingPage({ page, cb, readOnly }: { page: CatalogPage; cb: PageCallbacks; readOnly: boolean }) {
  const show = (key: string) => isFieldVisible(page, key);
  return <div className="drawing-layout">
    {show('drawingTitle') && <div className="page-heading centered drawing-heading"><span>TECHNICAL DRAWING</span><input readOnly={readOnly} value={page.fields.drawingTitle ?? ''} onChange={e => cb.onField('drawingTitle', e.target.value)} /></div>}
    <div className="drawing-full">
      <ImagePlaceholder image={page.image} label="ارفع الرسم أو المخطط" readOnly={readOnly} onUpload={file => cb.onUpload(file, 'page')} onRemove={() => cb.onRemoveImage('page')} />
    </div>
  </div>;
}

function TechnicalPage({ page, cb, readOnly }: { page: CatalogPage; cb: PageCallbacks; readOnly: boolean }) {
  const show = (key: string) => isFieldVisible(page, key);
  return <div className="technical-layout">
    {show('drawingTitle') && <div className="page-heading centered"><span>TECHNICAL DRAWING</span><input readOnly={readOnly} value={page.fields.drawingTitle} onChange={e => cb.onField('drawingTitle', e.target.value)} /></div>}
    {show('image') && <div className="drawing-frame"><ImagePlaceholder image={page.image} label="ارفع الرسم أو المخطط" readOnly={readOnly} onUpload={file => cb.onUpload(file, 'page')} onRemove={() => cb.onRemoveImage('page')} /><div className="dimension-tag tag-a">W: 000</div><div className="dimension-tag tag-b">H: 000</div><div className="dimension-line line-a" /><div className="dimension-line line-b" /></div>}
    {['scale', 'board', 'description'].some(show) && <div className="technical-info">{show('scale') && <div><span>مقياس الرسم</span><strong>{page.fields.scale}</strong></div>}{show('board') && <div><span>رقم اللوحة</span><strong>{page.fields.board}</strong></div>}{show('description') && <div><span>الوصف الفني</span><p>{page.fields.description}</p></div>}</div>}
    {show('notes') && <div className="notes-box"><b>ملاحظات</b><p>{page.fields.notes}</p></div>}
  </div>;
}

function MaterialsPage({ page, cb, readOnly }: { page: CatalogPage; cb: PageCallbacks; readOnly: boolean }) {
  const show = (key: string) => isFieldVisible(page, key);
  const visibleSamples = page.samples.map((sample, index) => ({ sample, index })).filter(({ sample }) => show(`sample:${sample.id}`));
  return <div className="materials-layout"><div className="page-heading centered"><span>MATERIAL LIBRARY</span>{show('section') && <input readOnly={readOnly} value={page.fields.section} onChange={e => cb.onField('section', e.target.value)} />}{show('description') && <p>{page.fields.description}</p>}</div>
    <div className="sample-grid">{visibleSamples.map(({ sample, index }) => {
      const sampleShow = (key: string) => show(`sample:${sample.id}:${key}`);
      const supplierCode = [sampleShow('supplier') ? sample.supplier || 'المورد' : '', sampleShow('code') ? sample.code || 'CODE-000' : ''].filter(Boolean).join(' / ');
      const attributes = [sampleShow('color') ? sample.color : '', sampleShow('use') ? sample.use || 'الاستخدام' : '', sampleShow('quantity') ? `${sample.quantity || '0'} قطعة` : ''].filter(Boolean).join(' · ');
      return <div className={`sample-card ${sampleShow('image') ? '' : 'no-image'}`} key={sample.id}>
        {sampleShow('image') && <ImagePlaceholder image={sample.image} label="صورة العينة" readOnly={readOnly} onUpload={file => cb.onUpload(file, `sample-${sample.id}`)} onRemove={() => cb.onRemoveImage(`sample-${sample.id}`)} />}
        <div className="sample-number">{String(index + 1).padStart(2, '0')}</div><div className="sample-info">
          {sampleShow('name') && <input readOnly={readOnly} value={sample.name} onChange={e => cb.onUpdateSample(sample.id, 'name', e.target.value)} />}
          {supplierCode && <span>{supplierCode}</span>}{attributes && <span>{attributes}</span>}
          {sampleShow('notes') && sample.notes && <p className="sample-notes">{sample.notes}</p>}
          {sampleShow('swatch') && <div className="sample-swatch" style={{ background: sample.swatch }} />}
        </div></div>;
    })}</div>
  </div>;
}

function PlanPage({ page, cb, readOnly }: { page: CatalogPage; cb: PageCallbacks; readOnly: boolean }) {
  const show = (key: string) => isFieldVisible(page, key);
  return <div className="plan-layout"><div className="page-heading centered"><span>SPACE PLAN / FURNITURE LAYOUT</span>{show('room') && <input readOnly={readOnly} value={page.fields.room} onChange={e => cb.onField('room', e.target.value)} />}{show('description') && <p>{page.fields.description}</p>}</div>
    {show('image') && <div className="plan-frame"><ImagePlaceholder image={page.image} label="ارفع مخطط التوزيع" readOnly={readOnly} onUpload={file => cb.onUpload(file, 'page')} onRemove={() => cb.onRemoveImage('page')} /><div className="plan-grid"><i /><i /><i /><i /><span>01</span><span>02</span><span>03</span></div></div>}
    {show('legend') && <div className="legend"><strong>مفتاح المخطط</strong><span><i className="legend-color dark" /> {page.fields.legend}</span></div>}
    {show('notes') && <div className="notes-box"><b>ملاحظات المقاسات</b><p>{page.fields.notes}</p></div>}
  </div>;
}

function FreePage({ page, cb, readOnly }: { page: CatalogPage; cb: PageCallbacks; readOnly: boolean }) {
  const show = (key: string) => isFieldVisible(page, key);
  return <div className="free-layout">{show('heading') && <div className="page-heading centered"><span>EDITORIAL PAGE</span><input readOnly={readOnly} value={page.fields.heading} onChange={e => cb.onField('heading', e.target.value)} /></div>}
    <div className={`free-columns ${show('image') ? '' : 'without-image'}`}><div>{show('body') && <textarea className="free-body" readOnly={readOnly} value={page.fields.body} onChange={e => cb.onField('body', e.target.value)} />}{show('body') && show('notes') && <div className="free-rule" />}{show('notes') && <textarea className="free-notes" readOnly={readOnly} value={page.fields.notes} onChange={e => cb.onField('notes', e.target.value)} />}</div>{show('image') && <ImagePlaceholder image={page.image} label="إضافة صورة" readOnly={readOnly} onUpload={file => cb.onUpload(file, 'page')} onRemove={() => cb.onRemoveImage('page')} />}</div>
  </div>;
}

export function CatalogPageView({ page, pageNumber, settings, callbacks, readOnly = false, clientNumber }: { page: CatalogPage; pageNumber?: number; settings: Record<string, string | boolean>; callbacks?: Partial<PageCallbacks>; readOnly?: boolean; clientNumber?: number | null }) {
  const cb: PageCallbacks = { ...noopCallbacks, ...callbacks };
  return <article className={`catalog-page page-${page.kind}`} style={{ '--primary': String(settings.primary), '--secondary': String(settings.secondary) } as React.CSSProperties}>
    <div className="page-ornament top" />{Boolean(settings.watermark) && <div className="page-watermark">{String(settings.companyEn)}</div>}<div className="page-brand"><img src={imageSrc(String(settings.logo || logoPath))} alt="شعار الشركة" /><span>{String(settings.companyEn)}</span></div>
    {page.kind === 'cover' && <CoverPage page={page} settings={settings} cb={cb} readOnly={readOnly} clientNumber={clientNumber} />}
    {page.kind === 'coverUpdated' && <UpdatedCoverPage page={page} cb={cb} readOnly={readOnly} clientNumber={clientNumber} />}
    {page.kind === 'productUpdated' && <UpdatedProductPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'materialsUpdated' && <UpdatedMaterialsPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'planUpdated' && <UpdatedPlanPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'product' && <ProductPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'technical' && <TechnicalPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'drawing' && <DrawingPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'materials' && <MaterialsPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'plan' && <PlanPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'free' && <FreePage page={page} cb={cb} readOnly={readOnly} />}
    <div className="page-footer-line"><span>{String(settings.footer)}{settings.phone ? `  •  ${String(settings.phone)}` : ''}</span><span>{Boolean(settings.showNumbers) && pageNumber ? `${String(pageNumber).padStart(2, '0')}  •  ` : ''}{String(settings.companyAr)}</span></div>
  </article>;
}
