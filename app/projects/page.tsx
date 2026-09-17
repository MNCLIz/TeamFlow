import { AuthProvider } from "@/components/providers/AuthProvider";
import { Header } from "@/components/shared/Header";
import { CreateProjectButton } from "./CreateProjectButton";
import { ProjectList } from "./projectList";

export default function ProjectsPage() {
  return (
    <AuthProvider>
      <Header title="Projects" />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">My Projects</h1>
            <CreateProjectButton />
          </div>
          <ProjectList />
        </div>
      </main>
    </AuthProvider>
  );
}
