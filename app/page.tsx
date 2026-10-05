import { AuthProvider } from "@/components/providers/AuthProvider";
import { HomeClient } from "./HomeClient";

export default function Home() {
  return (
    <AuthProvider>
      <HomeClient />
    </AuthProvider>
  );
}
