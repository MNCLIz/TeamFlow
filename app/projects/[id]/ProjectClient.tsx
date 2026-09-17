"use client";

import { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { toast } from "sonner";
import { ProjectType } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ProjectTasks } from "./Tasks/ProjectTasks";
import { ProjectDescription } from "./Description/ProjectDescription";

interface ProjectDetailsClientProps {
  project: ProjectType | null;
}

type TabView = "detail" | "tasks";

export default function ProjectClient({ project }: ProjectDetailsClientProps) {
  const [activeTab, setActiveTab] = useState<TabView>("detail");

  useEffect(() => {
    if (!project) {
      toast.error("获取项目信息失败", { position: "top-center" });
      redirect("/projects");
    }
  }, [project]);

  if (!project) return null;

  const {
    name,
    description,
    createdAt,
    updatedAt,
    role,
    owner,
    members,
    columns,
  } = project;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <Separator />
      <div className=" mx-40 px-8 py-10 space-y-10 flex-1">
        {/* Title section */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
        </div>
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
        {activeTab === "detail" && (
          <ProjectDescription
            owner={owner}
            role={role}
            createdAt={createdAt}
            updatedAt={updatedAt}
            members={members}
            description={description}
          />
        )}
      </div>
      {activeTab === "tasks" && (
        <ProjectTasks columns={columns} id={project.id} />
      )}
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
