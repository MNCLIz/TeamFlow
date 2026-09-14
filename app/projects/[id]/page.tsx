import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/shared/Header";
import { Board } from "@/components/board/Board";
import type { BoardColumn, Priority } from "@/types/board";

export default async function ProjectBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId: id } },
  });
  if (!member) redirect("/projects");

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      columns: {
        orderBy: { order: "asc" },
        include: {
          cards: {
            orderBy: { order: "asc" },
            include: { labels: true, attachments: true },
          },
        },
      },
    },
  });

  if (!project) redirect("/projects");

  const columns: BoardColumn[] = project.columns.map((col) => ({
    id: col.id,
    name: col.name,
    order: col.order,
    cards: col.cards.map((card) => ({
      id: card.id,
      title: card.title,
      description: card.description,
      content: card.content,
      priority: card.priority as Priority,
      dueDate: card.dueDate,
      order: card.order,
      columnId: card.columnId,
      createdById: card.createdById,
      assigneeId: card.assigneeId,
      labels: card.labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
      attachments: card.attachments.map((a) => ({
        id: a.id,
        name: a.name,
        url: a.url,
        size: a.size,
        mimeType: a.mimeType,
        createdAt: a.createdAt,
      })),
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    })),
  }));

  return (
    <>
      <Header />
      <main className="flex-1 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h1 className="font-semibold">{project.name}</h1>
        </div>
        <Board columns={columns} projectId={id} />
      </main>
    </>
  );
}
