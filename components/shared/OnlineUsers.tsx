"use client";

export function OnlineUsers({ users }: { users: { id: string; name?: string | null; image?: string | null }[] }) {
  return (
    <div className="flex items-center gap-1">
      {users.map((user) => (
        <div
          key={user.id}
          className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium"
          title={user.name ?? "User"}
        >
          {user.image ? (
            <img src={user.image} alt={user.name ?? ""} className="w-8 h-8 rounded-full" />
          ) : (
            user.name?.[0]?.toUpperCase() ?? "?"
          )}
        </div>
      ))}
    </div>
  );
}
