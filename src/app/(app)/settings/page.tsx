import { DangerZone, PasswordForm, ProfileForm } from "@/components/SettingsForms";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readDb } from "@/lib/store";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const user = await requireUser();
  const db = await readDb(user.id);
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Setup" title="Settings" sub={`Logged in as ${user.email}${user.role === "admin" ? " (admin)" : ""}.`} />
      {sp.welcome && (
        <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
          Welcome! Start with your profile: the interviewer and coach use it (German level, visa status, salary expectation are common silent rejecters).
        </p>
      )}
      <Card title="Your profile">
        <ProfileForm initial={{ ...db.profile, name: db.profile.name || user.name }} />
      </Card>
      <Card title="Password">
        <PasswordForm />
      </Card>
      <Card title="Your data">
        <p className="mb-3 text-sm text-muted">Everything is stored on this app’s own server. Webcam video is never stored; answer recordings are kept for the period set on Integrations.</p>
        <DangerZone />
      </Card>
    </div>
  );
}
