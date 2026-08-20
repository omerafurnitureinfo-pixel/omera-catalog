export type PageKind = 'cover' | 'product' | 'technical' | 'materials' | 'plan' | 'free';
export type MaterialSample = { id: string; name: string; supplier: string; code: string; color: string; use: string; quantity: string; notes: string; image?: string; swatch: string };
export type ProductRow = { id: string; label: string; value: string; visible: boolean };
export type CatalogPage = { id: string; kind: PageKind; title: string; hidden: boolean; image?: string; hiddenFields?: string[]; fields: Record<string, string>; rows: ProductRow[]; samples: MaterialSample[] };
export type ProjectData = { settings: Record<string, string | boolean>; pages: CatalogPage[] };
export type Project = { id: string; name: string; updatedAt: string } & ProjectData;

export const logoPath = '/assets/images/omera-logo-transparent.png';
export const defaultCoverPath = '/assets/images/omera-cover-a4.png';
export const pageNames: Record<PageKind, string> = { cover: 'غلاف ومقدمة', product: 'مواصفات منتج', technical: 'رسم فني', materials: 'خامات وأقمشة', plan: 'مخطط توزيع', free: 'صفحة حرة' };
export const swatches = ['#202829', '#8c6f4c', '#c9b18a', '#e1d9ca', '#66736b', '#a85748'];

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const blankSample = (): MaterialSample => ({ id: uid(), name: 'عينة جديدة', supplier: '', code: '', color: '', use: '', quantity: '1', notes: '', swatch: swatches[2] });

export const productRows = (): ProductRow[] => [
  { id: uid(), label: 'الوصف', value: 'قطعة أثاث مختارة بعناية', visible: true },
  { id: uid(), label: 'الأبعاد', value: 'W: 000 cm  |  H: 000 cm  |  D: 000 cm', visible: true },
  { id: uid(), label: 'الخامات', value: 'السطح: ______   |   القاعدة: ______   |   الظهر: ______', visible: true },
  { id: uid(), label: 'المورد والمجموعة', value: '', visible: true },
  { id: uid(), label: 'الكود والتشطيب', value: '', visible: true },
  { id: uid(), label: 'بريم', value: '', visible: true },
  { id: uid(), label: 'ملاحظات الاعتماد', value: '', visible: true },
];

export function makePage(kind: PageKind): CatalogPage {
  const common = { id: uid(), kind, title: pageNames[kind], hidden: false, hiddenFields: [] as string[], fields: {} as Record<string, string>, rows: [] as ProductRow[], samples: [] as MaterialSample[] };
  if (kind === 'cover') return { ...common, title: 'الغلاف', image: defaultCoverPath, fields: { companyAr: 'OMERA للتصميم الداخلي', companyEn: 'OMERA INTERIOR DESIGN', project: 'كتالوج الأثاث والمواصفات الفنية', client: 'اسم العميل', location: 'المملكة العربية السعودية', date: 'أغسطس 2026', designer: 'بالتعاون مع مصنع الابتكار الراقي للتنفيذ', intro: 'نصنع التفاصيل ... وننفذ الرؤية', contact: '0554588839  •  0573563025  •  omera.furniture@gmail.com' } };
  if (kind === 'product') return { ...common, title: 'مواصفات | قطعة أثاث', fields: { section: 'مجلس الرجال', product: 'اسم قطعة الأثاث', description: 'وصف مختصر للقطعة وتفاصيل استخدامها', quantity: '1', catalog: 'CAT-001', supplier: 'اسم المورد', finish: 'التشطيب أو الدهان', notes: 'تُراجع الأبعاد والعينة قبل الاعتماد.' }, rows: productRows() };
  if (kind === 'technical') return { ...common, title: 'الرسم الفني', fields: { drawingTitle: 'الرسم الفني والأبعاد', description: 'وصف فني للمخطط أو تفاصيل التصنيع.', scale: 'مقياس 1:20', board: 'A-001', notes: 'جميع الأبعاد بالسنتيمتر ما لم يذكر خلاف ذلك.' } };
  if (kind === 'materials') return { ...common, title: 'الخامات والأقمشة', fields: { section: 'لوحة الخامات والألوان', description: 'عينات مختارة للمشروع مع أكوادها ومعلومات المورد.' }, samples: [blankSample(), { ...blankSample(), name: 'قماش أساسي', code: 'FAB-024', color: 'رمادي دافئ', use: 'المقاعد', swatch: swatches[0] }] };
  if (kind === 'plan') return { ...common, title: 'مخطط توزيع الأثاث', fields: { room: 'غرفة المعيشة', description: 'مخطط توزيع مبدئي يوضح مواقع الأثاث ومسارات الحركة.', legend: 'الرمز الداكن: قطع رئيسية  |  الرمز الفاتح: قطع مساندة', notes: 'يراجع المخطط مع المقاسات النهائية للموقع.' } };
  return { ...common, title: 'صفحة حرة', fields: { heading: 'عنوان الصفحة', body: 'اكتب المحتوى هنا...', notes: 'ملاحظات إضافية' } };
}

export const defaultSettings: Record<string, string | boolean> = { companyAr: 'OMERA للتصميم الداخلي', companyEn: 'OMERA INTERIOR DESIGN', partner: 'بالتعاون مع مصنع الابتكار الراقي للتنفيذ', phone: '0554588839', phoneAlt: '0573563025', email: 'omera.furniture@gmail.com', instagram: 'omera.furniture', website: '', address: 'المملكة العربية السعودية', tagline: 'نصنع التفاصيل ... وننفذ الرؤية', primary: '#8c6f4c', secondary: '#d8cbb8', footer: 'OMERA  •  INTERIOR DESIGN', showNumbers: true, watermark: false, logo: logoPath };

export const newProjectData = (): ProjectData => ({ settings: { ...defaultSettings }, pages: [makePage('cover'), makePage('product'), makePage('technical')] });

export const isFieldVisible = (page: CatalogPage, key: string) => !(page.hiddenFields ?? []).includes(key);

export const normalizeProjectData = (data: ProjectData): ProjectData => ({
  settings: { ...defaultSettings, ...data.settings, logo: !data.settings?.logo || data.settings.logo === '/assets/images/omera-logo.jpg' ? logoPath : data.settings.logo },
  pages: (data.pages || []).map(page => ({ ...page, hiddenFields: page.hiddenFields ?? [] })),
});
