"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { TasksBoard } from "./Tasks/TasksBoard";
import { ProjectDetails } from "./Details/ProjectDetails";
import { CommentsPanel } from "@/components/shared/Comments/CommentsPanel";
import { useProjectStore } from "@/store/projectStore";
import { useBoardStore } from "@/store/boardStore";
import { useCommentStore } from "@/store/commentStore";
import { useUserDataStore } from "@/store/userDataStore";
import { useRealtime } from "@/hooks/useRealtime";
import { useComments } from "@/hooks/useComments";
import { useCommentReadState } from "@/hooks/useCommentReadState";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { EditableTitle } from "@/components/shared/EditableTitle";
import { ProjectType } from "@/types/project";
import { CommentScope } from "@/types/comment";

interface ProjectDetailsClientProps {
  // 项目数据由服务端页面获取后直接下发，客户端不再二次拉取
  project: ProjectType;
}

type TabView = "detail" | "tasks";

export default function ProjectClient({ project }: ProjectDetailsClientProps) {
  const [activeTab, setActiveTab] = useState<TabView>("detail");
  const [title, setTitle] = useState(project.name);
  // 桌面端右侧讨论面板默认展开；移动端抽屉默认关闭，避免进页面就弹层
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [mobileCommentsOpen, setMobileCommentsOpen] = useState(false);

  const { id, createdAt, updatedAt, role, owner } = project;

  const currentUserId = useUserDataStore((state) => state.id);
  // 与后端删除权限一致：作者本人、项目 ADMIN、项目 owner
  const canModerate = role === "ADMIN" || owner.id === currentUserId;

  const projectScope: CommentScope = useMemo(
    () => ({ type: "project", projectId: id }),
    [id],
  );
  // 面板收起时也要有未解决数，故数据拉取放在容器层
  const { comments, isLoading } = useComments(projectScope);
  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  // 讨论面板是否真的可见：宽屏看右侧面板（1024px 与 aside 的 lg 断点对齐），窄屏看抽屉
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const panelVisible = isDesktop ? commentsOpen : mobileCommentsOpen;
  // 未读状态：面板可见时收到的评论立即算已读，折叠时收到的不算（红点由此而来）
  // 分割线的起点由服务端在打开项目时算好（firstUnreadCommentId），本次会话内固定
  const { hasUnread } = useCommentReadState({
    projectId: id,
    comments,
    initialLastReadAt: project.lastReadAt,
    panelVisible,
  });
  // 红点只在"面板收着且还有未读"时出现；展开着收到消息不做任何提示
  const showUnreadDot = hasUnread && !panelVisible;

  // 将服务端下发的项目种入 store，使 addMember 等乐观更新有写入目标
  useEffect(() => {
    const { projects, addProject } = useProjectStore.getState();
    if (!projects.some((p) => p.id === project.id)) {
      addProject(project);
    }
  }, [project]);

  // members 订阅 store 而非静态 prop，添加成员后立即可见
  const members =
    useProjectStore(
      (state) => state.projects.find((p) => p.id === id)?.members,
    ) ?? project.members;

  const updateName = useProjectStore((state) => state.updateProject);

  // 项目级 SSE 订阅：卡片与评论事件共用这一条连接（Details 与 Tasks 页签都生效）
  // 事件回调直接走 store.getState()，保持 events 引用稳定，避免 useRealtime 重连
  const realtimeEvents = useMemo(
    () => ({
      "card:created": (data: unknown) =>
        useBoardStore.getState().applyRemoteEvent("card:created", data),
      "card:updated": (data: unknown) =>
        useBoardStore.getState().applyRemoteEvent("card:updated", data),
      "card:moved": (data: unknown) =>
        useBoardStore.getState().applyRemoteEvent("card:moved", data),
      "card:deleted": (data: unknown) =>
        useBoardStore.getState().applyRemoteEvent("card:deleted", data),
      "comment:created": (data: unknown) =>
        useCommentStore.getState().applyRemoteEvent("comment:created", data),
      "comment:updated": (data: unknown) =>
        useCommentStore.getState().applyRemoteEvent("comment:updated", data),
      "comment:deleted": (data: unknown) =>
        useCommentStore.getState().applyRemoteEvent("comment:deleted", data),
    }),
    [],
  );

  useRealtime({ projectId: id, events: realtimeEvents });

  // 宽屏切换右侧面板，窄屏改为打开抽屉（1024px 与 aside 的 lg 断点对齐）
  const handleToggleComments = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setCommentsOpen((open) => !open);
    } else {
      setMobileCommentsOpen(true);
    }
  };

  return (
    // 外层锁死一屏高度：内容列自己滚动，右侧讨论面板固定不动
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* 内容列：隐藏滚动条（与讨论面板的列表一致），保留滚轮/键盘滚动 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* 页头：标题 + 讨论入口，两个页签共用 */}
        <div className="mx-auto w-full max-w-3xl px-6 pt-8 sm:px-10 sm:pt-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <EditableTitle
                id={id}
                value={title}
                onChange={setTitle}
                readOnly={role !== "ADMIN"}
                updateName={updateName}
                className="text-2xl font-semibold tracking-tight"
              />
            </div>
            {/* 讨论入口：宽屏面板展开时淡出隐藏（保留占位，避免标题跳动），窄屏始终保留 */}
            {activeTab === "detail" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleComments}
                className={`shrink-0 text-muted-foreground hover:text-foreground transition-all duration-300 ease-out motion-reduce:transition-none ${
                  commentsOpen
                    ? "lg:pointer-events-none lg:invisible lg:translate-x-1 lg:opacity-0"
                    : "translate-x-0 opacity-100"
                }`}
              >
                <MessageSquare className="size-4" />
                讨论
                {unresolvedCount > 0 && (
                  <span className="relative inline-flex">
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {unresolvedCount}
                    </Badge>
                    {/* 折叠时收到未读评论：在评论数右上角点一个小灰点 */}
                    {showUnreadDot && (
                      <span
                        data-slot="comment-unread-dot"
                        aria-label="有未读评论"
                        className="absolute -top-1 -right-1 size-2 rounded-full bg-muted-foreground ring-2 ring-background"
                      />
                    )}
                  </span>
                )}
              </Button>
            )}
          </div>

          <div className="mt-6">
            <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
          </div>
        </div>

        {activeTab === "detail" ? (
          <div className="mx-auto w-full max-w-3xl px-6 pt-8 pb-16 sm:px-10">
            <ProjectDetails
              id={id}
              owner={owner}
              role={role}
              createdAt={createdAt}
              updatedAt={updatedAt}
              members={members}
            />
          </div>
        ) : (
          <TasksBoard projectId={id} />
        )}
      </div>

      {/* 右侧可收回的项目级讨论面板（宽屏）
          始终挂载、只过渡宽度：内容定宽并右对齐，收起时被 overflow 裁掉，
          视觉上表现为从屏幕右边缘滑入/滑出，而不是瞬间挂载/卸载 */}
      {activeTab === "detail" && (
        <aside
          inert={!commentsOpen}
          className={`hidden shrink-0 justify-end overflow-hidden bg-background transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none lg:flex ${
            commentsOpen ? "w-80" : "w-0"
          }`}
        >
          <div
            className={`flex w-80 shrink-0 flex-col border-l bg-background transition-opacity duration-300 ease-out motion-reduce:transition-none ${
              commentsOpen ? "opacity-100" : "opacity-0"
            }`}
          >
            <CommentsPanel
              scope={projectScope}
              comments={comments}
              isLoading={isLoading}
              currentUserId={currentUserId}
              canModerate={canModerate}
              unreadAnchorId={project.firstUnreadCommentId}
              onClose={() => setCommentsOpen(false)}
            />
          </div>
        </aside>
      )}

      {/* 窄屏降级为右侧抽屉 */}
      <Sheet open={mobileCommentsOpen} onOpenChange={setMobileCommentsOpen}>
        <SheetContent
          side="right"
          className="w-[85vw] p-0 sm:max-w-sm lg:hidden"
        >
          <CommentsPanel
            scope={projectScope}
            comments={comments}
            isLoading={isLoading}
            currentUserId={currentUserId}
            canModerate={canModerate}
            unreadAnchorId={project.firstUnreadCommentId}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Navigation({
  activeTab,
  setActiveTab,
}: {
  activeTab: TabView;
  setActiveTab: (tab: TabView) => void;
}) {
  const tabs: { key: TabView; label: string }[] = [
    { key: "detail", label: "内容" },
    { key: "tasks", label: "任务" },
  ];

  return (
    // 分段控件：浅灰底 + 白色选中块，比描边按钮更轻量
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
      {tabs.map(({ key, label }) => {
        const active = activeTab === key;
        return (
          <Button
            key={key}
            variant="ghost"
            size="sm"
            aria-current={active ? "page" : undefined}
            onClick={() => setActiveTab(key)}
            className={`px-3 transition-colors ${
              active
                ? "bg-background text-foreground shadow-xs hover:bg-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
