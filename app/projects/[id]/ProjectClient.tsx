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
    [id]
  );
  // 面板收起时也要有未解决数，故数据拉取放在容器层
  const { comments, isLoading } = useComments(projectScope);
  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  // 将服务端下发的项目种入 store，使 addMember 等乐观更新有写入目标
  useEffect(() => {
    const { projects, addProject } = useProjectStore.getState();
    if (!projects.some((p) => p.id === project.id)) {
      addProject(project);
    }
  }, [project]);

  // 将服务端下发的项目种入 store，使 addMember 等乐观更新有写入目标
  useEffect(() => {
    const { projects, addProject } = useProjectStore.getState();
    if (!projects.some((p) => p.id === project.id)) {
      addProject(project);
    }
  }, [project]);

  // members 订阅 store 而非静态 prop，添加成员后立即可见
  const members =
    useProjectStore((state) => state.projects.find((p) => p.id === id)?.members) ??
    project.members;

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
    []
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
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className=" mx-40 px-8 py-10 space-y-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <EditableTitle
                id={id}
                value={title}
                onChange={setTitle}
                readOnly={role !== "ADMIN"}
                updateName={updateName}
              />
            </div>
            {/* 讨论入口：宽屏面板展开时淡出隐藏（保留占位，避免标题跳动），窄屏始终保留 */}
            {activeTab === "detail" && (
              <Button
                variant="outline"
                onClick={handleToggleComments}
                className={`shrink-0 gap-1.5 transition-all duration-300 ease-out motion-reduce:transition-none ${
                  commentsOpen
                    ? "lg:pointer-events-none lg:invisible lg:translate-x-1 lg:opacity-0"
                    : "translate-x-0 opacity-100"
                }`}
              >
                <MessageSquare className="size-4" />
                讨论
                {unresolvedCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {unresolvedCount}
                  </Badge>
                )}
              </Button>
            )}
          </div>
          <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
          {activeTab === "detail" && (
            <ProjectDetails
              id={id}
              owner={owner}
              role={role}
              createdAt={createdAt}
              updatedAt={updatedAt}
              members={members}
            />
          )}
        </div>
        {activeTab === "tasks" && <TasksBoard projectId={id} />}
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
              onClose={() => setCommentsOpen(false)}
            />
          </div>
        </aside>
      )}

      {/* 窄屏降级为右侧抽屉 */}
      <Sheet open={mobileCommentsOpen} onOpenChange={setMobileCommentsOpen}>
        <SheetContent side="right" className="w-[85vw] p-0 sm:max-w-sm lg:hidden">
          <CommentsPanel
            scope={projectScope}
            comments={comments}
            isLoading={isLoading}
            currentUserId={currentUserId}
            canModerate={canModerate}
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
  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          onClick={() => setActiveTab("detail")}
          className={`
              ${
                activeTab === "detail"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }
            `}
        >
          内容
        </Button>
        <Button
          variant="outline"
          onClick={() => setActiveTab("tasks")}
          className={`
              ${
                activeTab === "tasks"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }
            `}
        >
          任务
        </Button>
      </div>
    </>
  );
}
