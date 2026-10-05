import { Header } from "@/components/shared/Header";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { TasksClient } from "./TasksClient";

export default function TasksPage() {
  return (
    <AuthProvider>
      <Header title="任务" href="/tasks" />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <TasksClient />
        </div>
      </main>
    </AuthProvider>
  );
}
