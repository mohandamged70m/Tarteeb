import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import SettingsForm from "@/components/SettingsForm";

export default async function SettingsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  return <SettingsForm />;
}
