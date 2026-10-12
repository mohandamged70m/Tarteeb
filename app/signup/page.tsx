import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthForm } from "@/components/AuthForm";

export default async function SignupPage() {
  const s = await getSession();
  if (s) redirect("/");
  return <AuthForm mode="signup" />;
}
