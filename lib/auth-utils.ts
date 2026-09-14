import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function checkProjectAccess(projectId: string, userId: string) {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return member;
}

export async function requireProjectAdmin(projectId: string, userId: string) {
  const member = await checkProjectAccess(projectId, userId);
  if (!member || member.role !== "ADMIN") {
    throw new Error("Forbidden");
  }
  return member;
}
