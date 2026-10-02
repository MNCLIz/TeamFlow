"use client";

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
import { Trash2 } from "lucide-react";

export function DeleteAlertDialog({
  id,
  confirmDelete,
  children,
  title = "确认删除?",
  description = "删除后无法恢复",
}: {
  id: string;
  confirmDelete: (id: string) => void;
  children?: React.ReactNode;
  title?: string;
  description?: string;
}) {
  return (
    <AlertDialog>
      <div onClick={(e) => e.preventDefault()}>
        <AlertDialogTrigger>
          {children ?? (
            <Trash2
              size={32}
              className="px-2 border rounded-lg hover:bg-red-200 hover:text-red-500"
            />
          )}
        </AlertDialogTrigger>
      </div>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <div onClick={(e) => e.preventDefault()}>
            <AlertDialogCancel>取消</AlertDialogCancel>
          </div>
          <div onClick={(e) => e.preventDefault()}>
            <AlertDialogAction onClick={() => confirmDelete(id)}>
              确认
            </AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
