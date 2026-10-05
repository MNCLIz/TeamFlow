"use client";

import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/projectStore";

export function CreateProjectButton() {
  const createProject = useProjectStore((state) => state.createProject);

  return (
    <Button
      onClick={() => createProject({ name: "新项目" })}
      className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
    >
      新建项目
    </Button>
  );
}
