import { System } from '../../types';
import type {
  Entity,
  SignalConfigComponent,
  SignalEmitRule,
  SignalActionRule,
  BehaviorComponent,
} from '../../types';
import type { GameObjectControllerComponent } from '../components/GameObjectController';
import { queueGameObjectControllerAction } from '../components/GameObjectController';
import {
  consumeQueuedSignalEvents,
  enqueueSignalEvent,
  type QueuedSignalEvent,
  type QueuedComponentEmitEvent,
} from '../signalRuntime';

const MAX_EVENTS_PER_FRAME = 5000;

export class EcsSignalSystem extends System {
  update(entities: Entity[], _deltaTime: number): void {
    let pending = consumeQueuedSignalEvents();
    if (pending.length === 0) return;

    const entityById = new Map(entities.map((entity) => [String(entity.id), entity]));
    let processed = 0;
    while (pending.length > 0) {
      const deferred: Array<Omit<QueuedSignalEvent, 'kind'>> = [];
      for (const event of pending) {
        processed += 1;
        if (processed > MAX_EVENTS_PER_FRAME) {
          console.warn(`[SignalSystem] Too many queued signal events in one frame (>${MAX_EVENTS_PER_FRAME}), remaining events are dropped.`);
          return;
        }

        if (event.kind === 'signal') {
          this.applySignalEvent(entities, event);
          continue;
        }

        deferred.push(...this.resolveComponentEmit(event, entityById));
      }

      for (const event of deferred) {
        enqueueSignalEvent(event);
      }

      pending = consumeQueuedSignalEvents();
    }
  }

  private applySignalEvent(entities: Entity[], event: QueuedSignalEvent): void {
    for (const entity of entities) {
      if (event.scopeSelfId !== undefined && String(entity.id) !== event.scopeSelfId) continue;
      const config = entity.components.get('SignalConfig') as SignalConfigComponent | undefined;
      if (!config) continue;
      for (const rule of config.rules) {
        if (rule.kind !== 'action') continue;
        if (rule.event !== event.id) continue;
        if (rule.when && !evaluateWhenExpr(rule.when, event.payload, entity)) continue;
        this.applyActionRule(entities, entity, rule, event.payload);
      }
    }
  }

  private resolveComponentEmit(
    event: QueuedComponentEmitEvent,
    entityById: Map<string, Entity>,
  ): Array<Omit<QueuedSignalEvent, 'kind'>> {
    const sourceEntity = entityById.get(event.sourceEntityId);
    if (!sourceEntity) return [];

    const config = sourceEntity.components.get('SignalConfig') as SignalConfigComponent | undefined;
    if (!config) return [];

    const emitted: Array<Omit<QueuedSignalEvent, 'kind'>> = [];
    for (const rule of config.rules) {
      if (rule.kind !== 'emit') continue;
      if (rule.from.trim().toLowerCase() !== event.from.trim().toLowerCase()) continue;
      if (rule.emit.trim() !== event.emit.trim()) continue;
      if (rule.when && !evaluateWhenExpr(rule.when, event.payload, sourceEntity)) continue;

      emitted.push({
        id: rule.signal,
        payload: {
          ...event.payload,
          ...resolveEmitPayloadArgs(rule, event.payload, sourceEntity),
        },
      });
    }
    return emitted;
  }

  private applyActionRule(
    _entities: Entity[],
    entity: Entity,
    rule: SignalActionRule,
    payload: Record<string, unknown>,
  ): void {
    const normalizedTarget = rule.target.trim().toLowerCase();

    if (normalizedTarget === 'gameobjectcontroller') {
      const controller = entity.components.get('GameObjectController') as GameObjectControllerComponent | undefined;
      if (!controller) return;
      queueGameObjectControllerAction(controller, rule.action, resolveActionArgs(rule, payload, entity));
      return;
    }

    if (normalizedTarget === 'behavior') {
      const behavior = entity.components.get('Behavior') as BehaviorComponent | undefined;
      if (behavior?.instance?.onMessage) {
        behavior.instance.onMessage(rule.action, resolveActionArgs(rule, payload, entity));
      }
      return;
    }
  }
}

function evaluateWhenExpr(expr: string, payload: Record<string, unknown>, entity: Entity): boolean {
  try {
    const fn = new Function('payload', 'self', `return Boolean(${expr});`);
    return Boolean(fn(payload, entity));
  } catch {
    return false;
  }
}

function resolveActionArgs(
  rule: SignalActionRule,
  payload: Record<string, unknown>,
  entity: Entity,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rule.args)) {
    resolved[key] = resolveBindingValue(value, payload, entity);
  }
  return resolved;
}

function resolveEmitPayloadArgs(
  rule: SignalEmitRule,
  payload: Record<string, unknown>,
  entity: Entity,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rule.args)) {
    const finalValue = resolveBindingValue(value, payload, entity);
    writePath(resolved, key, finalValue);
  }
  return resolved;
}

function resolveBindingValue(
  rawValue: string | number | boolean,
  payload: Record<string, unknown>,
  entity: Entity,
): unknown {
  if (typeof rawValue !== 'string') return rawValue;
  if (rawValue.startsWith('payload.')) {
    return readPath(payload, rawValue.slice('payload.'.length));
  }
  if (rawValue.startsWith('ctx.')) {
    return readPath(payload, rawValue.slice('ctx.'.length));
  }
  if (rawValue.startsWith('self.')) {
    return readPath(entity as unknown as Record<string, unknown>, rawValue.slice('self.'.length));
  }
  return rawValue;
}

function readPath(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let cursor: unknown = source;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) return;

  let cursor = target;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    const current = cursor[segment];
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[segments[segments.length - 1]] = value;
}
