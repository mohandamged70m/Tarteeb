import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Intake from "@/components/Intake";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  const sp = await searchParams;
  return <Intake initialId={sp.c ?? null} />;
}
