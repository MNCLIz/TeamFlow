import Link from "next/link";
import { Header } from "@/components/shared/Header";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold mb-4">TaskBoard</h1>
        <p className="text-gray-600 mb-8 text-center max-w-md">
          Real-time collaborative task management board. Create projects, manage tasks, and collaborate with your team.
        </p>
        <Link href="/projects" className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">
          Get Started
        </Link>
      </main>
    </>
  );
}
