import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";

const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const projects = await prisma.project.findMany({
    include: { columns: { orderBy: { order: "asc" } } },
  });

  for (const project of projects) {
    const cols = project.columns;

    // Rename "待办" -> "接下来"
    const todoCol = cols.find((c) => c.name === "待办");
    if (todoCol) {
      await prisma.column.update({
        where: { id: todoCol.id },
        data: { name: "接下来", order: 1 },
      });
      console.log(`[项目 ${project.id}] "待办" -> "接下来"`);
    }

    // Check if "未开始" already exists
    const hasNotStarted = cols.some((c) => c.name === "未开始");
    if (!hasNotStarted) {
      await prisma.column.create({
        data: { name: "未开始", order: 0, projectId: project.id },
      });
      console.log(`[项目 ${project.id}] 新增 "未开始" 列`);
    }

    // Shift other columns' order if needed
    // After adding "未开始"(0) and renaming "待办"->"接下来"(1),
    // ensure remaining columns have correct order
    const updatedCols = await prisma.column.findMany({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
    });

    for (let i = 0; i < updatedCols.length; i++) {
      if (updatedCols[i].order !== i) {
        await prisma.column.update({
          where: { id: updatedCols[i].id },
          data: { order: i },
        });
        console.log(
          `[项目 ${project.id}] "${updatedCols[i].name}" order: ${updatedCols[i].order} -> ${i}`
        );
      }
    }
  }

  console.log(`\n完成，共处理 ${projects.length} 个项目`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
