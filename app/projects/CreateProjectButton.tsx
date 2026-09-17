"use client";

import { Button } from "@/components/ui/button";
import { postProjectsAPI } from "@/lib/api/ProjectsAPI";

export function CreateProjectButton() {
  const createProject = async () => {
    const res = await postProjectsAPI({ name: "New Project" });
    console.log(res);
  };

  return (
    <Button
      onClick={() => createProject()}
      className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
    >
      New Project
    </Button>
  );
}
