"use client";

import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/projectStore";

export function CreateProjectButton() {
  const createProject = useProjectStore((state) => state.createProject);

  return (
    <Button
      onClick={() => createProject({ name: "New Project" })}
      className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
    >
      New Project
    </Button>
  );
}
