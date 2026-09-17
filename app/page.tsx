import { AuthProvider } from "@/components/providers/AuthProvider";

export default function Home() {
  return (
    <AuthProvider>
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <div>
          <h1 className="text-4xl font-bold">TaskBoard</h1>
        </div>
      </main>
    </AuthProvider>
  );
}
