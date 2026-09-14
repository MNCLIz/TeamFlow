import { NextRequest } from "next/server";
import { requireAuth, checkProjectAccess } from "@/lib/auth-utils";
import { addConnection, removeConnection } from "@/lib/sse";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: projectId } = await params;

  const member = await checkProjectAccess(projectId, user.id);
  if (!member) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      addConnection(projectId, controller);

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          removeConnection(projectId, controller);
        }
      }, 30000);

      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ userId: user.id })}\n\n`));

      const cleanup = () => {
        clearInterval(heartbeat);
        removeConnection(projectId, controller);
      };

      // Store cleanup on the request signal for graceful shutdown
      _request.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
