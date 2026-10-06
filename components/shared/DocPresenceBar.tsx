"use client";

import { useEffect, useState } from "react";
import type { CollabPeer } from "@/hooks/useCollabDoc";

/**
 * 协作文档的在线用户条。
 *
 * 数据来自 WS 的 awareness（Yjs 协议自带），**不走 SSE**：presence 属于「文档级、秒级、
 * 频繁变化」的状态，SSE 那条连接负责的是业务通知（卡片/评论），混在一起会让心跳与重连
 * 语义互相干扰。断线时 awareness 不再更新，这里只额外显示一个「离线」标记。
 *
 * 头像复用项目成员胶囊的观感：圆形头像 + 两字姓名兜底，最多展示 4 个再折叠成 +N。
 */
const MAX_AVATARS = 4;

export function DocPresenceBar({
  peers,
  offline = false,
  status = null,
}: {
  peers: CollabPeer[];
  offline?: boolean;
  status?: string | null;
}) {
  const [open, setOpen] = useState(false);

  // 折叠列表展开后，点到别处或按 Esc 就收起来
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 断线时即使只有自己也要显示（要挂「离线编辑中」标记）
  if (peers.length === 0 && !offline) return null;
  const shown = peers.slice(0, MAX_AVATARS);
  const rest = peers.slice(MAX_AVATARS);

  return (
    <div
      data-slot="doc-presence-bar"
      data-count={peers.length}
      data-offline={offline ? "true" : "false"}
      data-status={status ?? "unknown"}
      className="mt-3 flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground"
    >
      <span className="flex items-center -space-x-1.5">
        {shown.map((peer) => (
          <PeerAvatar key={peer.clientId} peer={peer} />
        ))}
      </span>

      {rest.length > 0 && (
        <span className="relative">
          <button
            type="button"
            data-slot="doc-presence-more"
            aria-label={`还有 ${rest.length} 人在线`}
            aria-expanded={open}
            onClick={(event) => {
              // 阻止冒泡：否则会被上面的 window click 立刻关掉
              event.stopPropagation();
              setOpen((value) => !value);
            }}
            className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground ring-2 ring-background hover:bg-muted/70"
          >
            +{rest.length}
          </button>
          {open && (
            <span
              data-slot="doc-presence-list"
              className="absolute bottom-full left-0 z-20 mb-1 block w-40 rounded-lg border bg-popover p-1 shadow-md"
            >
              {rest.map((peer) => (
                <span
                  key={peer.clientId}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-left"
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: peer.color }}
                  />
                  <span className="truncate text-foreground">{peer.name}</span>
                  {peer.isSelf && <span className="text-muted-foreground">（你）</span>}
                </span>
              ))}
            </span>
          )}
        </span>
      )}

      <span className="truncate">
        <span data-slot="doc-presence-count">{peers.length}</span> 人在线
      </span>

      {offline && (
        <span
          data-slot="doc-presence-offline"
          className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-400"
          title="连接已断开，你的改动会先存在本地，连上后自动合并"
        >
          <span className="size-1.5 rounded-full bg-amber-500" />
          离线编辑中
        </span>
      )}
    </div>
  );
}

function PeerAvatar({ peer }: { peer: CollabPeer }) {
  const initial = peer.name.trim().slice(0, 2) || "?";

  return (
    <span
      data-slot="doc-presence-avatar"
      data-user-id={peer.userId}
      data-self={peer.isSelf ? "true" : "false"}
      title={peer.isSelf ? `${peer.name}（你）` : peer.name}
      style={{ borderColor: peer.color }}
      className="relative inline-flex size-6 items-center justify-center overflow-hidden rounded-full border-2 bg-muted text-[10px] font-medium text-foreground ring-2 ring-background"
    >
      {peer.image ? (
        // 头像是外链（GitHub 等），用原生 img 避免 next/image 的域名白名单配置
        // eslint-disable-next-line @next/next/no-img-element
        <img src={peer.image} alt={peer.name} className="size-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
