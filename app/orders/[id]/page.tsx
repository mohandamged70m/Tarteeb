import { redirect } from "next/navigation";
import { getSession, getRepo } from "@/lib/auth";
import OrderDetail from "@/components/OrderDetail";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) redirect("/login");
  const { id } = await params;
  const profile = await getRepo().getProfile(s.userId);
  return <OrderDetail id={id} timezone={profile?.timezone ?? "UTC"} />;
}
