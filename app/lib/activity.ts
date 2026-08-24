import { getDb } from "../../db";
import { activityLog } from "../../db/schema";

export type ActivityAction = "created" | "status_changed" | "progress_updated" | "payment_updated";

// يُستدعى من route handlers فقط (يستخدم getDb الخاص بالخادم).
export async function logActivity(params: {
  projectId: string;
  userId: number | null;
  userDisplayName: string;
  action: ActivityAction;
  details?: string;
}): Promise<void> {
  const db = getDb();
  await db.insert(activityLog).values({
    projectId: params.projectId,
    userId: params.userId,
    userDisplayName: params.userDisplayName,
    action: params.action,
    details: params.details ?? null,
    createdAt: new Date().toISOString(),
  });
}
