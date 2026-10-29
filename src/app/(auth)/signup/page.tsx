import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";
import { readApp } from "@/lib/store";

export default async function SignupPage() {
  if (await currentUser()) redirect("/");
  const app = await readApp();
  return <AuthForm mode="signup" firstUser={app.users.length === 0} signupsOpen={app.allowSignups} />;
}
