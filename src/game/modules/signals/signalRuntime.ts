export interface QueuedSignalEvent {
  kind: 'signal';
  id: string;
  payload: Record<string, unknown>;
  scopeSelfId?: string;
  isGlobal?: boolean;
}

export interface QueuedComponentEmitEvent {
  kind: 'componentEmit';
  sourceEntityId: string;
  from: string;
  emit: string;
  payload: Record<string, unknown>;
}

export type QueuedSignalRuntimeEvent = QueuedSignalEvent | QueuedComponentEmitEvent;

const queue: QueuedSignalRuntimeEvent[] = [];

export function enqueueSignalEvent(event: Omit<QueuedSignalEvent, 'kind'>): void {
  queue.push({
    kind: 'signal',
    ...event,
  });
}

export function enqueueComponentEmitEvent(event: Omit<QueuedComponentEmitEvent, 'kind'>): void {
  queue.push({
    kind: 'componentEmit',
    ...event,
  });
}

export function consumeQueuedSignalEvents(): QueuedSignalRuntimeEvent[] {
  if (queue.length === 0) return [];
  const snapshot = queue.slice();
  queue.length = 0;
  return snapshot;
}
