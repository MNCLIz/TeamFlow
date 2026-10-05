import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MemberType, ProjectType } from "@/types/project";
import { SectionHeader } from "./SectionHeader";

// 头像最多露 3 个，其余折成 +N
const MAX_AVATARS = 3;
const ROLE_LABELS = { ADMIN: "管理员", MEMBER: "成员" } as const;

/**
 * 首页「最近项目」：按 updatedAt 倒序取前几个（排序由接口给出，HomeClient 只做截断）。
 * 整卡可点，进项目详情；成员头像堆叠展示协作规模。
 */
export function RecentProjectsSection({ projects }: { projects: ProjectType[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="最近项目"
        action={
          <Link
            data-slot="home-all-projects"
            href="/projects"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            查看全部
          </Link>
        }
      />

      {projects.length === 0 ? (
        <p
          data-slot="home-projects-empty"
          className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
        >
          还没有项目，点右上角「新建项目」开始
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              data-slot="home-project-card"
              data-project-id={project.id}
              className="flex flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="truncate text-sm font-medium">{project.name}</h3>
                <Badge
                  variant={project.role === "ADMIN" ? "secondary" : "outline"}
                  className={project.role === "ADMIN" ? "" : "text-muted-foreground"}
                >
                  {ROLE_LABELS[project.role] ?? ROLE_LABELS.MEMBER}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-3">
                <AvatarGroup>{renderMembers(project.members)}</AvatarGroup>
                <span className="shrink-0 text-xs text-muted-foreground">
                  更新于 {formatUpdated(project.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function renderMembers(members: MemberType[]) {
  const visible = members.slice(0, MAX_AVATARS);
  const rest = members.length - visible.length;

  return (
    <>
      {visible.map((member) => (
        <Avatar key={member.id} size="sm">
          {member.user.image && (
            <AvatarImage src={member.user.image} alt={member.user.name ?? ""} />
          )}
          <AvatarFallback>
            {(member.user.name ?? member.user.email ?? "?")[0]}
          </AvatarFallback>
        </Avatar>
      ))}
      {rest > 0 && <AvatarGroupCount>+{rest}</AvatarGroupCount>}
    </>
  );
}

function formatUpdated(value: Date | string): string {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}
