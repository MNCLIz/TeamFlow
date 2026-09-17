import { Header } from "../../components/shared/Header";
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function Tasks() {
  return (
    <AuthProvider>
      <Header title="Tasks" />
      <div className="flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold">Tasks</h1>
      </div>
    </AuthProvider>
  );
}
