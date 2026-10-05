import { useEffect, useState } from "react";
import { MdEditor, type SaveState } from "@/components/shared/MdEditor";
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
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const projects = useProjectStore((state) => state.projects);
  const project = projects.find((project) => project.id === projectId);
  const { description } = project ?? {};

  const updateDescription = useProjectStore((state) => state.updateProject);

  // 「已保存」只停留一会儿，避免长期的视觉噪声
  useEffect(() => {
    if (saveState !== "saved") return;
    const timer = setTimeout(() => setSaveState("idle"), 1800);
    return () => clearTimeout(timer);
  }, [saveState]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">描述</h2>
        {/* 编辑态反馈：保存中 / 已保存（只读成员看不到） */}
        {!readOnly && (
          <span aria-live="polite" className="text-xs text-muted-foreground">
            {saveState === "saving"
              ? "保存中…"
              : saveState === "saved"
                ? "已保存"
                : ""}
          </span>
        )}
      </div>

      {readOnly && !description ? (
        <p className="text-sm text-muted-foreground">暂无描述</p>
      ) : (
        <MdEditor
          id={projectId}
          defaultValue={description ?? ""}
          readOnly={readOnly}
          placeholder="添加项目描述，支持 Markdown…"
          onSaveStateChange={setSaveState}
          wrapperClassName={`leading-relaxed text-foreground/80 ${
            readOnly
              ? ""
              : "-mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/40 focus-within:bg-muted/40"
          }`}
          updateDescription={updateDescription}
        />
      )}
    </section>
  );
}
