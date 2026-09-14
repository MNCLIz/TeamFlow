const connections = new Map<string, Set<ReadableStreamDefaultController>>();

export function addConnection(projectId: string, controller: ReadableStreamDefaultController) {
  if (!connections.has(projectId)) {
    connections.set(projectId, new Set());
  }
  connections.get(projectId)!.add(controller);
}

export function removeConnection(projectId: string, controller: ReadableStreamDefaultController) {
  const set = connections.get(projectId);
  if (set) {
    set.delete(controller);
    if (set.size === 0) {
      connections.delete(projectId);
    }
  }
}

export function broadcast(projectId: string, event: string, data: unknown) {
  const set = connections.get(projectId);
  if (!set) return;

  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const controller of set) {
    try {
      controller.enqueue(new TextEncoder().encode(message));
    } catch {
      set.delete(controller);
    }
  }
}
