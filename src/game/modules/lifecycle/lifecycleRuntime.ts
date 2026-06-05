const pendingDestroyEntityIds = new Set<string>();

export function queueEntityDestroy(entityId: string): void {
  pendingDestroyEntityIds.add(entityId);
}

export function consumeQueuedDestroyEntityIds(): string[] {
  if (pendingDestroyEntityIds.size === 0) return [];
  const ids = Array.from(pendingDestroyEntityIds);
  pendingDestroyEntityIds.clear();
  return ids;
}
