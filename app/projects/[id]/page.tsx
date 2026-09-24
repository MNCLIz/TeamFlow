import { AuthProvider } from "@/components/providers/AuthProvider";
import { Header } from "@/components/shared/Header";
import ProjectClient from "./ProjectClient";
import { getProjectAPI } from "@/lib/api/ProjectsAPI";
import { cookies } from "next/headers";

export default async function ProjectDetails({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const Cookie = (await cookies()).toString();
  const CurrentProject = await getProjectAPI({ id, Cookie });

  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <Header title="Projects" extra={CurrentProject.name} />
        <ProjectClient id={id} />
      </div>
    </AuthProvider>
  );
}
