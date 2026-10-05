import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MemberRole, MemberType } from "@/types/project";
import { UserType } from "@/types/user";
import { DescriptionDetail } from "./DescriptionDetail";
import { AddMemberDialog } from "./AddMemberDialog";

// 项目详情（「内容」页签）：属性 / 成员 / 描述 三段式，用细分隔线分节
export function ProjectDetails({
  id,
  owner,
  role,
  createdAt,
  updatedAt,
  members,
}: {
  id: string;
  owner: UserType;
  role: MemberRole;
  createdAt: Date;
  updatedAt: Date;
  members: MemberType[];
}) {
  return (
    <div className="space-y-8">
      {/* 属性区：键值行，标签列定宽保证纵向对齐 */}
      <div className="space-y-3">
        <PropertyRow label="负责人">
          <span className="flex min-w-0 items-center gap-2">
            <Avatar size="sm">
              {owner.image && (
                <AvatarImage src={owner.image} alt={owner.name ?? ""} />
              )}
              <AvatarFallback>
                {(owner.name ?? owner.email ?? "?")[0]}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">
              {owner.name ?? owner.email}
            </span>
          </span>
        </PropertyRow>

        <PropertyRow label="我的角色">
          <Badge
            variant={role === "ADMIN" ? "secondary" : "outline"}
            className={role === "ADMIN" ? "" : "text-muted-foreground"}
          >
            {role === "ADMIN" ? "管理员" : "成员"}
          </Badge>
        </PropertyRow>

        <PropertyRow label="创建于">
          <span className="text-sm text-muted-foreground">
            {formatDate(createdAt)}
          </span>
        </PropertyRow>

        <PropertyRow label="更新于">
          <span className="text-sm text-muted-foreground">
            {formatDate(updatedAt)}
          </span>
        </PropertyRow>
      </div>

      <Divider />

      {/* 团队成员 */}
      <section className="space-y-3">
        <SectionHeader
          title="成员"
          meta={members.length}
          action={role === "ADMIN" ? <AddMemberDialog projectId={id} /> : null}
        />
        <ul className="flex flex-wrap gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-2 rounded-full border border-border/70 bg-card py-1 pr-3 pl-1 transition-colors hover:bg-muted/50"
            >
              <Avatar size="sm">
                {member.user.image && (
                  <AvatarImage
                    src={member.user.image}
                    alt={member.user.name ?? ""}
                  />
                )}
                <AvatarFallback>
                  {(member.user.name ?? member.user.email ?? "?")[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">
                {member.user.name ?? member.user.email}
              </span>
              {/* 只标注身份上有区别的成员，避免每个成员都挂标签 */}
              {member.userId === owner.id ? (
                <span className="text-[11px] text-muted-foreground">
                  所有者
                </span>
              ) : (
                member.role === "ADMIN" && (
                  <span className="text-[11px] text-muted-foreground">
                    管理员
                  </span>
                )
              )}
            </li>
          ))}
        </ul>
      </section>

      <Divider />

      {/* 项目描述 */}
      <DescriptionDetail projectId={id} role={role} />
    </div>
  );
}

function PropertyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-20 shrink-0 text-sm text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}

function SectionHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: number;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        {title}
        {meta !== undefined && (
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {meta}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-border" />;
}

function formatDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
