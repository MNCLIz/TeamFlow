import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MemberRole, MemberType } from "@/types/project";
import { UserType } from "@/types/user";
import { DescriptionDetail } from "./DescriptionDetail";

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
    <>
      {/* Properties grid — Notion-style key-value layout */}
      <div className="space-y-4">
        {/* 创建者 */}
        <PropertyRow label="Owner">
          <div className="flex items-center gap-2">
            <Avatar size="sm">
              {owner.image && (
                <AvatarImage src={owner.image} alt={owner.name ?? ""} />
              )}
              <AvatarFallback>{(owner?.name ?? "?")[0]}</AvatarFallback>
            </Avatar>
            <span className="text-sm">{owner?.name ?? owner?.email}</span>
          </div>
        </PropertyRow>

        {/* 角色 */}
        <PropertyRow label="Role">
          <Badge variant={role === "ADMIN" ? "default" : "secondary"}>
            {role}
          </Badge>
        </PropertyRow>

        {/* 创建时间  更新时间 */}
        <PropertyRow label="Created">
          <span className="text-sm text-muted-foreground">
            {new Date(createdAt).toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </PropertyRow>
        <PropertyRow label="Updated">
          <span className="text-sm text-muted-foreground">
            {new Date(updatedAt).toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </PropertyRow>

        {/* 团队成员 */}
        <PropertyRow label="Members">
          {members.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-1.5">
                  <Avatar size="sm">
                    {member.user.image && (
                      <AvatarImage
                        src={member.user.image}
                        alt={member.user.name ?? ""}
                      />
                    )}
                    <AvatarFallback>
                      {(member.user.name ?? "?")[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">
                    {member.user.name ?? member.user.email}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No members</span>
          )}
        </PropertyRow>

        {/* 项目详情 */}
        <DescriptionDetail projectId={id} role={role} />
      </div>
    </>
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
    <div className="flex items-start gap-4 py-1">
      <span className="w-24 shrink-0 text-sm text-muted-foreground pt-0.5">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
