import { redirect } from "next/navigation";
import { getSession, getRepo } from "@/lib/auth";
import OrdersList from "@/components/OrdersList";

export default async function OrdersPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const profile = await getRepo().getProfile(s.userId);
  return <OrdersList timezone={profile?.timezone ?? "UTC"} />;
}
