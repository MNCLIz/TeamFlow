"use client";

import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { toast } from "sonner";
import { ProjectType } from "@/types/project";
import { Button } from "@/components/ui/button";
import { TasksBoard } from "./Tasks/TasksBoard";
import { ProjectDetails } from "./Details/ProjectDetails";
import { useProjectStore } from "@/store/projectStore";
import { useBoardStore } from "@/store/boardStore";
import { EditableTitle } from "@/components/shared/EditableTitle";

interface ProjectDetailsClientProps {
  project: ProjectType | null;
}

type TabView = "detail" | "tasks";

export default function ProjectClient({ project }: ProjectDetailsClientProps) {
  const [activeTab, setActiveTab] = useState<TabView>("detail");
  const [title, setTitle] = useState(project?.name ?? "");

  const updateName = useProjectStore((state) => state.updateProject);

  const fetchColumns = useBoardStore((state) => state.fetchColumns);

  useEffect(() => {
    if (!project) {
      toast.error("获取项目信息失败", { position: "top-center" });
      redirect("/projects");
    }
  }, [project]);

  if (!project) return null;

  const { id, createdAt, updatedAt, role, owner, members } = project;
  fetchColumns(id);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className=" mx-40 px-8 py-10 space-y-10">
        <EditableTitle
          id={id}
          value={title}
          onChange={setTitle}
          readOnly={role !== "ADMIN"}
          updateName={updateName}
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
          />
        )}
      </div>
      {activeTab === "tasks" && <TasksBoard />}
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
