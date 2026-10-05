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
      {/* h-full（而不是 min-h-screen）：页面高度锁定为一屏，
          滚动交给 ProjectClient 里的内容列，右侧讨论面板才能固定不动 */}
      <div className="flex h-full flex-col">
        <Header title="项目" href="/projects" extra={CurrentProject.name} />
        <ProjectClient project={CurrentProject} />
      </div>
    </AuthProvider>
  );
}
