import { Board } from "./board/Board";
import { ColumnType } from "@/types/board";

export function ProjectTasks({
  columns,
  id,
}: {
  columns: ColumnType[];
  id: string;
}) {
  return (
    <>
      <Board columns={columns!} projectId={id!} />
    </>
  );
}
