import { redirect } from "next/navigation";
import { getSessionUser } from "../lib/auth";
import AccountantClient from "./accountant-client";

export const dynamic = "force-dynamic";

export default async function AccountantPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "accountant") redirect(user.role === "factory" ? "/factory" : "/");

  return <AccountantClient user={user} />;
}
