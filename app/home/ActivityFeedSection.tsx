import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ActivityType } from "@/types/activity";
import { describeActivity, formatActivityTime } from "@/lib/activity";
import { SectionHeader } from "./SectionHeader";

/**
 * 首页「动态」：我参与的项目里最近发生的事（Activity 表）。
 * 排序与截断由接口 / HomeClient 决定，这里只渲染；文案规则集中在 lib/activity.ts（纯函数）。
 *
 * 本期不做实时推送：进入首页拉取一次，其他成员的新动态需要刷新才能看到（见 AGENTS.md 的 Pending）。
 */
export function ActivityFeedSection({
  activities,
}: {
  activities: ActivityType[];
}) {
  return (
    <section className="space-y-3">
      <SectionHeader
        title="动态"
        count={activities.length > 0 ? activities.length : undefined}
      />

      {activities.length === 0 ? (
        <p
          data-slot="home-activity-empty"
          className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
        >
          暂时没有动态，项目里的操作会出现在这里
        </p>
      ) : (
        <ul
          data-slot="home-activity-list"
          className="flex flex-col divide-y rounded-lg border"
        >
          {activities.map((activity) => (
            <ActivityRow key={activity.id} activity={activity} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityRow({ activity }: { activity: ActivityType }) {
  const { verb, target, detail } = describeActivity(activity);
  const name = activity.user.name ?? "某位成员";
  const createdAt = new Date(activity.createdAt);
  const exactTime = Number.isNaN(createdAt.getTime())
    ? undefined
    : createdAt.toISOString();

  return (
    <li
      data-slot="home-activity-row"
      data-activity-id={activity.id}
      data-action={activity.action}
      className="flex items-start gap-3 px-4 py-3"
    >
      <Avatar size="sm" className="mt-0.5">
        {activity.user.image && (
          <AvatarImage src={activity.user.image} alt={name} />
        )}
        <AvatarFallback>{name[0]}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p data-slot="home-activity-text" className="text-sm">
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground"> {verb}</span>
          {target && <span className="font-medium">「{target}」</span>}
        </p>
        {detail && (
          <p
            data-slot="home-activity-detail"
            className="mt-0.5 truncate text-xs text-muted-foreground"
          >
            {detail}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <time
          data-slot="home-activity-time"
          dateTime={exactTime}
          title={exactTime ? createdAt.toLocaleString("zh-CN") : undefined}
          className="text-xs text-muted-foreground"
        >
          {formatActivityTime(activity.createdAt)}
        </time>
        <Link
          data-slot="home-activity-project"
          href={`/projects/${activity.project.id}`}
          className="max-w-[10rem] truncate text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {activity.project.name}
        </Link>
      </div>
    </li>
  );
}
