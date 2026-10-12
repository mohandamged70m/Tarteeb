import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ClientDetail from "@/components/ClientDetail";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const { id } = await params;
  return <ClientDetail id={id} />;
}
