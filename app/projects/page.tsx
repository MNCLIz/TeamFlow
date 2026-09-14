import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Header } from "@/components/shared/Header";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const memberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id },
    include: { project: true },
  });

  return (
    <>
      <Header />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">My Projects</h1>
            <button className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">
              New Project
            </button>
          </div>
          {memberships.length === 0 ? (
            <p className="text-gray-500 text-center py-12">No projects yet. Create your first project!</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {memberships.map(({ project, role }: { project: typeof memberships[number]["project"]; role: string }) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="block p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <h3 className="font-semibold">{project.name}</h3>
                  {project.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{project.description}</p>}
                  <span className="text-xs text-gray-400 mt-2 inline-block">{role}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
