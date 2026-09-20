import { MdEditor } from "./MdEditor";
import { MemberRole } from "@/types/project";

export function DescriptionDetail({
  projectId,
  role,
  description = "",
  onDescriptionChange,
}: {
  projectId: string;
  role: MemberRole;
  description: string;
  onDescriptionChange?: (description: string) => void;
}) {
  const readOnly = role === "MEMBER";

  return (
    <>
      <div className="w-full h-full">
        <div className="w-24 shrink-0 text-ml text-muted-foreground pt-0.5">
          description
        </div>
        <MdEditor
          projectId={projectId}
          defaultValue={description ?? ""}
          readOnly={readOnly}
          onSave={onDescriptionChange}
        />
      </div>
    </>
  );
}
