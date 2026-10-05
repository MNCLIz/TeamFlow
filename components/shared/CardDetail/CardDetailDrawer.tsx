import { CardDetail } from "@/components/shared/CardDetail/CardDetail";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { CardType } from "@/types/board";

export function CardDetailDrawer({
  children,
  card,
}: {
  children: React.ReactNode;
  card: CardType;
}) {
  return (
    <Drawer swipeDirection="right">
      <DrawerTrigger>{children}</DrawerTrigger>
      {/* 任务详情：定宽侧栏；内容由 CardDetail 自己分成「固定头部 + 滚动内容区」 */}
      <DrawerContent className="w-[600px] max-w-[100vw]">
        <CardDetail card={card} />
      </DrawerContent>
    </Drawer>
  );
}
