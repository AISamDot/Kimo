import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";
import { readApp } from "@/lib/store";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  const app = await readApp();
  if (app.users.length === 0) redirect("/signup");
  return <AuthForm mode="login" firstUser={false} signupsOpen={app.allowSignups} />;
}
