import { CardDetail } from "@/components/shared/CardDetail";
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
      <DrawerContent className="w-[600px] data-[vaul-drawer-direction=bottom]:max-h-[50vh] data-[vaul-drawer-direction=top]:max-h-[50vh]">
        <CardDetail card={card} />
      </DrawerContent>
    </Drawer>
  );
}
