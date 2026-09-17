// 用于将登录状态同步到store中

"use client";

import { useEffect } from "react";
import { useUserDataStore } from "@/store/userDataStore";

export function SessionSync({
  user,
}: {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}) {
  const setUserData = useUserDataStore((s) => s.setUserData);

  useEffect(() => {
    setUserData({
      id: user.id,
      name: user.name ?? "",
      email: user.email ?? "",
      image: user.image ?? "",
    });
  }, [user.id, user.name, user.email, user.image, setUserData]);

  return null;
}
