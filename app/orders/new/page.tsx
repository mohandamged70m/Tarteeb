import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import NewOrderForm from "@/components/NewOrderForm";

export default async function NewOrderPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  return <NewOrderForm />;
}
