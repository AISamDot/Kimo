import { Nav } from "@/components/Nav";
import { TaskTray } from "@/components/TaskTray";
import { requireUser } from "@/lib/auth";
import { readDb } from "@/lib/store";
import { refreshFinderIfStale, visibleTasks } from "@/lib/tasks";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  await refreshFinderIfStale(user.id);
  const tasks = visibleTasks((await readDb(user.id)).tasks);
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Nav name={user.name} isAdmin={user.role === "admin"} />
      <main className="fade-in mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      <TaskTray initial={tasks} />
    </div>
  );
}
