import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ClientsList from "@/components/ClientsList";

export default async function ClientsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  return <ClientsList />;
}
