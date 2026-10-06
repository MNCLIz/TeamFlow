import { useRef } from "react";
import { type MdEditorHandle } from "@/components/shared/MdEditor";
import { CollabMdEditor } from "@/components/shared/CollabMdEditor";
import { MdFileActions } from "@/components/shared/MdEditor/MdFileActions";
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
  // 供「导出 Markdown」读取编辑器当前正文
  const editorRef = useRef<MdEditorHandle>(null);

  const projects = useProjectStore((state) => state.projects);
  const project = projects.find((project) => project.id === projectId);
  const { description, name } = project ?? {};

  // MEMBER 且无描述时只显示空态，不渲染编辑器（也就没有可导出的正文）
  const hasEditor = !(readOnly && !description);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">描述</h2>
        {hasEditor && (
          <MdFileActions
            className="ml-auto"
            editorRef={editorRef}
            title={name ?? ""}
            fallbackId={projectId}
            readOnly={readOnly}
          />
        )}
      </div>

      {hasEditor ? (
        <CollabMdEditor
          ref={editorRef}
          docName={`project-${projectId}`}
          seedMarkdown={description ?? ""}
          readOnly={readOnly}
          placeholder="添加项目描述，支持 Markdown…"
          wrapperClassName={`leading-relaxed text-foreground/80 ${
            readOnly
              ? ""
              : "-mx-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/40 focus-within:bg-muted/40"
          }`}
        />
      ) : (
        <p className="text-sm text-muted-foreground">暂无描述</p>
      )}
    </section>
  );
}
