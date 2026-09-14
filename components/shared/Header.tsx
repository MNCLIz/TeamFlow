import Link from "next/link";
import { auth } from "@/lib/auth";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b px-6 py-3 flex items-center justify-between">
      <Link href="/" className="font-bold text-lg">
        TaskBoard
      </Link>
      <nav className="flex items-center gap-4">
        {session?.user ? (
          <>
            <span className="text-sm">{session.user.name ?? session.user.email}</span>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="text-sm hover:underline">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="text-sm hover:underline">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
