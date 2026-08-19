import { redirect } from "next/navigation";
import { getSessionUser } from "../lib/auth";
import FactoryClient from "./factory-client";

export const dynamic = "force-dynamic";

export default async function FactoryPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <FactoryClient user={user} />;
}
