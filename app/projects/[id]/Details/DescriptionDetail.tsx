import { MdEditor } from "@/components/shared/MdEditor";
import { MemberRole } from "@/types/project";
import { useProjectStore } from "@/store/projectStore";

export function DescriptionDetail({
  projectId,
  role,
}: {
  projectId: string;
  role: MemberRole;
}) {
  const readOnly = role === "MEMBER";

  const projects = useProjectStore((state) => state.projects);
  const project = projects.find((project) => project.id === projectId);
  const { description } = project ?? {};

  const updateDescription = useProjectStore((state) => state.updateProject);

  return (
    <>
      <div className="w-full h-full">
        <div className="w-24 shrink-0 text-ml text-muted-foreground pt-0.5">
          description
        </div>
        <MdEditor
          id={projectId}
          defaultValue={description ?? ""}
          readOnly={readOnly}
          updateDescription={updateDescription}
        />
      </div>
    </>
  );
}
