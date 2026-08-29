import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { projectImages } from "../../../../db/schema";
import { getSessionUserFromRequest } from "../../../lib/auth";
import { toRouteErrorMessage } from "../../../lib/db-error";

// تُعرض الصورة لأي حساب مسجّل دخوله (المهندس والمصنع والمحاسب يعرضون
// الكتالوج). المعرّف عشوائي وغير قابل للتخمين، والصورة ثابتة لا تتغير
// فنسمح بتخزينها في الكاش طويلًا لتسريع التصفح والطباعة.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const me = await getSessionUserFromRequest(request);
    if (!me) return Response.json({ error: "الرجاء تسجيل الدخول" }, { status: 401 });

    const { id } = await context.params;
    const db = getDb();
    const [row] = await db.select().from(projectImages).where(eq(projectImages.id, id)).limit(1);
    if (!row) return Response.json({ error: "الصورة غير موجودة" }, { status: 404 });

    const match = /^data:([^;]+);base64,(.*)$/s.exec(row.data);
    if (!match) return Response.json({ error: "الصورة تالفة" }, { status: 500 });

    const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
    return new Response(bytes, {
      headers: {
        "Content-Type": match[1],
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return Response.json({ error: toRouteErrorMessage(error) }, { status: 500 });
  }
}
