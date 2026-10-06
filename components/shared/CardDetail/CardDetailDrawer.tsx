import { CardDetail } from "@/components/shared/CardDetail/CardDetail";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { CardType } from "@/types/board";

/**
 * 任务详情抽屉。两种用法：
 * - 传 children：children 作为触发器（列表行、看板卡片自己包裹）
 * - 不传 children：受控打开（如新建任务后自动打开刚刚建好的那条），由 open / onOpenChange 控制
 */
export function CardDetailDrawer({
  children,
  card,
  open,
  onOpenChange,
}: {
  children?: React.ReactNode;
  card: CardType;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Drawer swipeDirection="right" open={open} onOpenChange={onOpenChange}>
      {children ? <DrawerTrigger>{children}</DrawerTrigger> : null}
      {/* 任务详情：定宽侧栏；内容由 CardDetail 自己分成「固定头部 + 滚动内容区」 */}
      <DrawerContent className="w-[600px] max-w-[100vw]">
        <CardDetail card={card} />
      </DrawerContent>
    </Drawer>
  );
}
