"use client";

import { useEffect, useRef, useState } from "react";
import { redirect } from "next/navigation";
import { toast } from "sonner";
import { ProjectType } from "@/types/project";
import { Button } from "@/components/ui/button";
import { ProjectTasks } from "./Tasks/ProjectTasks";
import { ProjectDetails } from "./Details/ProjectDetails";
import { useProjectStore } from "@/store/projectStore";
import { useBoardStore } from "@/store/boardStore";

interface ProjectDetailsClientProps {
  project: ProjectType | null;
}

type TabView = "detail" | "tasks";

export default function ProjectClient({ project }: ProjectDetailsClientProps) {
  const [activeTab, setActiveTab] = useState<TabView>("detail");
  const [description, setDescription] = useState(project?.description ?? "");
  const [title, setTitle] = useState(project?.name ?? "");

  const setColumns = useBoardStore((state) => state.setColumns);

  useEffect(() => {
    if (!project) {
      toast.error("获取项目信息失败", { position: "top-center" });
      redirect("/projects");
    }
  }, [project]);

  if (!project) return null;

  const { id, createdAt, updatedAt, role, owner, members, columns } = project;
  setColumns(columns);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className=" mx-40 px-8 py-10 space-y-10">
        <EditableTitle
          projectId={id}
          value={title}
          onChange={setTitle}
          readOnly={role !== "ADMIN"}
        />
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        {activeTab === "detail" && (
          <ProjectDetails
            id={id}
            owner={owner}
            role={role}
            createdAt={createdAt}
            updatedAt={updatedAt}
            members={members}
            description={description}
            onDescriptionChange={setDescription}
          />
        )}
      </div>
      {activeTab === "tasks" && <ProjectTasks />}
    </div>
  );
}

function Navigation({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabView;
  setActiveTab: (tab: TabView) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          onClick={() => setActiveTab("detail")}
          className={`
              ${
                activeTab === "detail"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }
            `}
        >
          内容
        </Button>
        <Button
          variant="outline"
          onClick={() => setActiveTab("tasks")}
          className={`
              ${
                activeTab === "tasks"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }
            `}
        >
          任务
        </Button>
      </div>
    </>
  );
}

function EditableTitle({
  projectId,
  value,
  onChange,
  readOnly,
}: {
  projectId: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSavedRef = useRef(value);
  const updateProject = useProjectStore((state) => state.updateProject);

  const save = async () => {
    const trimmed = inputRef.current?.value.trim() ?? "";
    if (trimmed === lastSavedRef.current) return;
    if (!trimmed) {
      if (inputRef.current) inputRef.current.value = lastSavedRef.current;
      return;
    }
    try {
      await updateProject({ id: projectId, name: trimmed });
      lastSavedRef.current = trimmed;
      onChange(trimmed);
    } catch {
      toast.error("项目名称更新失败");
      if (inputRef.current) inputRef.current.value = lastSavedRef.current;
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => save();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      save();
    };
  }, [projectId]);

  if (readOnly) {
    return <h1 className="text-3xl font-bold tracking-tight">{value}</h1>;
  }

  return (
    <input
      ref={inputRef}
      defaultValue={value}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className="text-3xl font-bold tracking-tight bg-transparent border-none outline-none focus:ring-0 rounded px-1 -ml-1 w-full"
    />
  );
}
