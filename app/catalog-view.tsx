import { ChangeEvent, useRef } from 'react';
import { Globe2, ImagePlus, Instagram, Mail, MapPin, Phone, X } from 'lucide-react';
import { CatalogPage, MaterialSample, ProductRow, isFieldVisible, logoPath } from './catalog-types';

export function Field({ label, value, onChange, multiline = false, readOnly = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; readOnly?: boolean }) {
  return <label className="field"><span className="field-label-row"><span>{label}</span></span>{multiline ? <textarea value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} /> : <input value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} />}</label>;
}

export function ImagePlaceholder({ image, label, onUpload, onRemove, readOnly = false }: { image?: string; label: string; onUpload: (file: File) => void; onRemove: () => void; readOnly?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ''; };
  return <div className={`image-placeholder ${image ? 'has-image' : ''} ${readOnly ? 'read-only' : ''}`} onClick={() => !readOnly && inputRef.current?.click()}>
    {image ? <img src={image} alt="" /> : <><ImagePlus size={24} /><strong>{label}</strong>{!readOnly && <small>اضغط لرفع صورة أو استبدالها</small>}</>}
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
    {show('logo') && <div className="cover-monogram"><img src={String(settings.logo || logoPath)} alt="شعار OMERA" /><span>CATALOGUE / 2026</span></div>}
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
      <textarea className="spec-value" readOnly={readOnly} value={row.value} onChange={e => cb.onUpdateRow(row.id, 'value', e.target.value)} />
      {(row.image || !readOnly) && <div className="spec-row-image"><ImagePlaceholder image={row.image} label="إضافة صورة" readOnly={readOnly} onUpload={file => cb.onUpload(file, `row-${row.id}`)} onRemove={() => cb.onRemoveImage(`row-${row.id}`)} /></div>}
    </div>
  </div>)}</div>}
  {show('notes') && <div className="approval-note"><span>ملاحظات الاعتماد</span><p>{page.fields.notes || '—'}</p></div>}
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
    <div className="page-ornament top" />{Boolean(settings.watermark) && <div className="page-watermark">{String(settings.companyEn)}</div>}<div className="page-brand"><img src={String(settings.logo || logoPath)} alt="شعار الشركة" /><span>{String(settings.companyEn)}</span></div>
    {page.kind === 'cover' && <CoverPage page={page} settings={settings} cb={cb} readOnly={readOnly} clientNumber={clientNumber} />}
    {page.kind === 'product' && <ProductPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'technical' && <TechnicalPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'materials' && <MaterialsPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'plan' && <PlanPage page={page} cb={cb} readOnly={readOnly} />}
    {page.kind === 'free' && <FreePage page={page} cb={cb} readOnly={readOnly} />}
    <div className="page-footer-line"><span>{String(settings.footer)}{settings.phone ? `  •  ${String(settings.phone)}` : ''}</span><span>{Boolean(settings.showNumbers) && pageNumber ? `${String(pageNumber).padStart(2, '0')}  •  ` : ''}{String(settings.companyAr)}</span></div>
  </article>;
}
