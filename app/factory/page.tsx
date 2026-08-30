import { redirect } from "next/navigation";
import { getSessionUser } from "../lib/auth";
import FactoryClient from "./factory-client";

export const dynamic = "force-dynamic";

export default async function FactoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "factory") redirect(user.role === "accountant" ? "/accountant" : "/");

  return <FactoryClient user={user} />;
}
