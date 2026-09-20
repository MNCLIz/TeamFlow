import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shared/Sidebar/Sidebar";
import { SessionSync } from "./SessionSync";

export async function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <SidebarProvider>
      <SessionSync user={session.user} />
      <AppSidebar />
      <SidebarTrigger />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </SidebarProvider>
  );
}
