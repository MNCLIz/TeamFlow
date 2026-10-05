"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProjectStore } from "@/store/projectStore";
import { MemberRole } from "@/types/project";

// 添加项目成员弹窗：输入邮箱 + 选择角色，确认后调用 POST /projects/[id]/members
export function AddMemberDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("MEMBER");
  const [submitting, setSubmitting] = useState(false);

  const addMember = useProjectStore((state) => state.addMember);

  const handleConfirm = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("请输入成员邮箱", { position: "top-center" });
      return;
    }
    setSubmitting(true);
    try {
      await addMember({ projectId, email: trimmed, role });
      toast.success("成员添加成功", { position: "top-center" });
      setOpen(false);
      setEmail("");
      setRole("MEMBER");
    } catch (err) {
      // request 封装抛出的是字符串错误信息
      toast.error(typeof err === "string" ? err : "添加成员失败", {
        position: "top-center",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* 成员分节标题右侧的邀请入口 */}
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <UserPlus />
        邀请成员
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加项目成员</DialogTitle>
          <DialogDescription>
            输入成员邮箱并选择成员身份，确认后发送邀请。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="member-email" className="text-sm font-medium">
              邮箱
            </label>
            <Input
              id="member-email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="member-role" className="text-sm font-medium">
              成员身份
            </label>
            <select
              id="member-role"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="MEMBER">成员</option>
              <option value="ADMIN">管理员</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>取消</DialogClose>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? "提交中..." : "确认"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
