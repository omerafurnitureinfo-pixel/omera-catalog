import { redirect } from "next/navigation";
import { getSessionUser } from "./lib/auth";
import EditorClient from "./editor-client";

// هذه الصفحة تعتمد على جلسة الدخول لكل طلب، فلا يصح تخزينها كصفحة ثابتة.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "factory") redirect("/factory");
  if (user.role === "accountant") redirect("/accountant");

  return <EditorClient user={user} />;
}
