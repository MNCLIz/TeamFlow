"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useUserDataStore } from "@/store/userDataStore";
import { useShallow } from "zustand/shallow";

export function AppSidebarFooter() {
  const { name, image } = useUserDataStore(
    useShallow((state) => ({
      name: state.name,
      image: state.image,
    })),
  );
  return (
    <div className="flex items-center gap-2 mx-4 my-2">
      <Avatar>
        <AvatarImage src={image} alt={name} />
        <AvatarFallback>{(name ?? "?")[0]}</AvatarFallback>
      </Avatar>
      <span className="flex-1 min-w-0 text-sm truncate">{name}</span>
      {/* 登出：仅图标按钮，点击弹窗确认，确认后退出并跳转登录页 */}
      <AlertDialog>
        <AlertDialogTrigger
          aria-label="登出"
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut size={18} />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出登录?</AlertDialogTitle>
            <AlertDialogDescription>退出后需要重新登录才能继续使用</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => signOut({ redirectTo: "/login" })}>
              退出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
