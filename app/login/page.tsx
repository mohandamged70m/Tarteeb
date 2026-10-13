import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ confirmation?: string }> }) {
  const s = await getSession();
  if (s) redirect("/");
  const { confirmation } = await searchParams;
  return <AuthForm mode="signin" initialError={confirmation === "failed" ? "This confirmation link is invalid or expired. Request a new signup confirmation." : undefined} />;
}
