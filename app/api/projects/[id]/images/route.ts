import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { projectImages, projects } from "../../../../../db/schema";
import { getSessionUserFromRequest } from "../../../../lib/auth";
import { toRouteErrorMessage } from "../../../../lib/db-error";

// حد أمان لكل صورة على حدة. الصور تُضغط في المتصفح قبل الرفع، فأي صورة
// أكبر من هذا الحد تعني خللًا وليس استخدامًا عاديًا.
const MAX_IMAGE_BYTES = 1_500_000;

// رفع صورة واحدة وتخزينها منفصلة عن ملف المشروع. تُستدعى مرة عند اختيار
// الصورة فقط، فلا تُرسَل الصور مجددًا مع كل حفظ للمشروع.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me || me.role !== "engineer") {
      return Response.json({ error: "رفع الصور متاح لحساب المهندس فقط" }, { status: 403 });
    }

    const { id } = await context.params;
    const payload = (await request.json()) as { data?: unknown };
    if (typeof payload.data !== "string" || !payload.data.startsWith("data:image/")) {
      return Response.json({ error: "صيغة الصورة غير صحيحة" }, { status: 400 });
    }
    if (payload.data.length > MAX_IMAGE_BYTES) {
      return Response.json({ error: "حجم الصورة كبير جدًا. اختر صورة أصغر." }, { status: 413 });
    }

    const db = getDb();
    const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).limit(1);
    if (!project) return Response.json({ error: "المشروع غير موجود" }, { status: 404 });

    const imageId = `${id}-${crypto.randomUUID()}`;
    await db.insert(projectImages).values({ id: imageId, projectId: id, data: payload.data });

    return Response.json({ id: imageId }, { status: 201 });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
