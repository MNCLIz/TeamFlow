"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useUserDataStore } from "@/store/userDataStore";
import { useShallow } from "zustand/shallow";

export function AppSidebarFooter() {
  const { name, image } = useUserDataStore(
    useShallow((state) => ({
      name: state.name,
      image: state.image,
    })),
  );
  return (
    <>
      <Avatar className="mx-4 my-2">
        <AvatarImage src={image} alt={name} />
        <AvatarFallback>{(name ?? "?")[0]}</AvatarFallback>
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-2">
          {name}
        </div>
      </Avatar>
    </>
  );
}
