import { System } from '../../types';
import type {
  Entity,
  SignalConfigComponent,
  SignalEmitRule,
  SignalActionRule,
  BehaviorComponent,
} from '../../types';
import type { GameObjectControllerComponent } from '../lifecycle/GameObjectController';
import { queueGameObjectControllerAction } from '../lifecycle/GameObjectController';
import {
  consumeQueuedSignalEvents,
  enqueueSignalEvent,
  type QueuedSignalEvent,
  type QueuedComponentEmitEvent,
} from './signalRuntime';
import { sendDebugCommand } from '../../../debug/DebugLogger';

const MAX_EVENTS_PER_FRAME = 5000;
const DEBUG_SIGNAL_SYSTEM = true;

export class EcsSignalSystem extends System {
  update(entities: Entity[], _deltaTime: number): void {
    let pending = consumeQueuedSignalEvents();
    if (pending.length === 0) return;
    this.debug('update:start', { pending: pending.length });

    const entityById = new Map(entities.map((entity) => [String(entity.id), entity]));
    const entityByName = new Map<string, Entity>();
    for (const entity of entities) {
      if (entity.name) {
        entityByName.set(entity.name, entity);
      }
    }

    let processed = 0;
    while (pending.length > 0) {
      const deferred: Array<Omit<QueuedSignalEvent, 'kind'>> = [];
      for (const event of pending) {
        processed += 1;
        if (processed > MAX_EVENTS_PER_FRAME) {
          sendDebugCommand({
            level: 'WARN',
            source: 'SignalSystem',
            message: `Too many queued signal events in one frame (>${MAX_EVENTS_PER_FRAME}), remaining events are dropped.`,
          });
          return;
        }

        if (event.kind === 'signal') {
          this.applySignalEvent(entities, event, entityById, entityByName);
          continue;
        }

        deferred.push(...this.resolveComponentEmit(event, entityById));
      }

      for (const event of deferred) {
        enqueueSignalEvent(event);
      }

      pending = consumeQueuedSignalEvents();
    }
    this.debug('update:done', { processed });
  }

  private applySignalEvent(
    entities: Entity[],
    event: QueuedSignalEvent,
    entityById: Map<string, Entity>,
    entityByName: Map<string, Entity>
  ): void {
    this.debug('signal:received', {
      id: event.id,
      isGlobal: Boolean(event.isGlobal),
      scopeSelfId: event.scopeSelfId,
      payload: event.payload,
    });

    for (const entity of entities) {
      const isLocal = event.scopeSelfId !== undefined && String(entity.id) === event.scopeSelfId;
      const isGlobal = event.isGlobal === true;
      if (!isGlobal && !isLocal) continue;

      const config = entity.components.get('SignalConfig') as SignalConfigComponent | undefined;
      if (!config) continue;

      for (const rule of config.rules) {
        if (rule.kind !== 'action') continue;

        const ruleEvent = rule.event.trim();
        let ruleScope: 'LOCAL' | 'GLOBAL' = 'LOCAL';
        let ruleSignalName = ruleEvent;

        if (ruleEvent.startsWith('GLOBAL:')) {
          ruleScope = 'GLOBAL';
          ruleSignalName = ruleEvent.slice('GLOBAL:'.length);
        } else if (ruleEvent.startsWith('LOCAL:')) {
          ruleScope = 'LOCAL';
          ruleSignalName = ruleEvent.slice('LOCAL:'.length);
        } else if (ruleEvent.startsWith('INTERFACE:')) {
          const interfaceName = ruleEvent.slice('INTERFACE:'.length);
          const iface = config.interfaces?.find(i => i.name === interfaceName && i.direction === 'out');
          if (iface) {
            const internalEvent = iface.internal;
            if (internalEvent.startsWith('GLOBAL:')) {
              ruleScope = 'GLOBAL';
              ruleSignalName = internalEvent.slice('GLOBAL:'.length);
            } else if (internalEvent.startsWith('LOCAL:')) {
              ruleScope = 'LOCAL';
              ruleSignalName = internalEvent.slice('LOCAL:'.length);
            } else {
              ruleScope = 'LOCAL';
              ruleSignalName = internalEvent;
            }
          } else {
            continue;
          }
        }

        if (ruleSignalName !== event.id) continue;
        if (ruleScope === 'GLOBAL' && !isGlobal) continue;
        if (ruleScope === 'LOCAL' && !isLocal) continue;
        if (rule.when && !evaluateWhenExpr(rule.when, event.payload, entity)) continue;

        this.applyActionRule(entities, entity, rule, event.payload, entityById, entityByName);
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

      let isGlobal = false;
      let signalName = rule.signal.trim();
      if (signalName.startsWith('GLOBAL:')) {
        isGlobal = true;
        signalName = signalName.slice('GLOBAL:'.length);
      } else if (signalName.startsWith('LOCAL:')) {
        isGlobal = false;
        signalName = signalName.slice('LOCAL:'.length);
      }

      emitted.push({
        id: signalName,
        isGlobal,
        scopeSelfId: isGlobal ? undefined : String(sourceEntity.id),
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
    entityById: Map<string, Entity>,
    entityByName: Map<string, Entity>
  ): void {
    this.debug('rule:matched', {
      entityId: entity.id,
      target: rule.target,
      action: rule.action,
      emit: rule.emit,
      payload,
    });

    if (rule.emit) {
      let emitSignalName = rule.emit.trim();
      let isGlobal = false;
      if (emitSignalName.startsWith('GLOBAL:')) {
        isGlobal = true;
        emitSignalName = emitSignalName.slice('GLOBAL:'.length);
      } else if (emitSignalName.startsWith('LOCAL:')) {
        isGlobal = false;
        emitSignalName = emitSignalName.slice('LOCAL:'.length);
      }

      const resolvedArgs = resolveActionArgs(rule, payload, entity);

      enqueueSignalEvent({
        id: emitSignalName,
        isGlobal,
        scopeSelfId: isGlobal ? undefined : String(entity.id),
        payload: {
          ...payload,
          ...resolvedArgs,
        },
      });
      this.debug('rule:emit-dispatched', {
        sourceEntityId: entity.id,
        emitSignalName,
        isGlobal,
      });
    }

    if (!rule.target) return;

    let targetStr = rule.target.trim();
    let action = rule.action || '';
    const args = resolveActionArgs(rule, payload, entity);
    const actionPayload: Record<string, unknown> = {
      ...payload,
      ...args,
    };

    if (targetStr.startsWith('INTERFACE:')) {
      const interfaceName = targetStr.slice('INTERFACE:'.length);
      const config = entity.components.get('SignalConfig') as SignalConfigComponent | undefined;
      const iface = config?.interfaces?.find(i => i.name === interfaceName && i.direction === 'in');

      if (iface) {
        const internal = iface.internal;
        if (internal.includes('/')) {
          const [newTarget, newAction] = internal.split('/');
          targetStr = newTarget;
          action = newAction;
        } else {
          targetStr = internal;
        }
      } else {
        this.reportSignalIssue('interface target not found', {
          entityId: entity.id,
          target: rule.target,
          action,
          eventPayload: payload,
        });
        return;
      }
    }

    if (targetStr.startsWith('ENTITY:')) {
      const slashIndex = targetStr.indexOf('/');
      if (slashIndex === -1) {
        this.reportSignalIssue('invalid ENTITY target format', {
          sourceEntityId: entity.id,
          target: rule.target,
          action,
        });
        return;
      }

      const entityPart = targetStr.slice('ENTITY:'.length, slashIndex);
      const subTargetPart = targetStr.slice(slashIndex + 1);

      const targetEntity = entityById.get(entityPart) || entityByName.get(entityPart);
      if (!targetEntity) {
        this.reportSignalIssue('target entity not found', {
          sourceEntityId: entity.id,
          target: rule.target,
          parsedEntityRef: entityPart,
          action,
        });
        return;
      }

      this.applySubTargetAction(targetEntity, subTargetPart, action, actionPayload);
      return;
    }

    this.applySubTargetAction(entity, targetStr, action, actionPayload);
  }

  private applySubTargetAction(
    entity: Entity,
    subTarget: string,
    action: string,
    args: Record<string, unknown>
  ): void {
    const normalizedSubTarget = subTarget.trim().toLowerCase();

    if (normalizedSubTarget === 'gameobjectcontroller') {
      const controller = entity.components.get('GameObjectController') as GameObjectControllerComponent | undefined;
      if (!controller) {
        this.reportSignalIssue('target GameObjectController component missing', {
          entityId: entity.id,
          action,
        });
        return;
      }
      this.debug('action:queueGameObjectControllerAction', {
        entityId: entity.id,
        action,
        args,
      });
      queueGameObjectControllerAction(controller, action, args);
      return;
    }

    if (normalizedSubTarget.startsWith('behavior')) {
      let targetBehaviorType: string | undefined;
      if (normalizedSubTarget.includes(':')) {
        targetBehaviorType = normalizedSubTarget.split(':')[1];
      }

      const behavior = entity.components.get('Behavior') as BehaviorComponent | undefined;
      if (!behavior) {
        this.reportSignalIssue('target Behavior component missing', {
          entityId: entity.id,
          subTarget,
          action,
        });
        return;
      }

      if (targetBehaviorType && behavior.behaviorType.toLowerCase() !== targetBehaviorType) {
        this.reportSignalIssue('target Behavior type mismatch', {
          entityId: entity.id,
          expectedBehaviorType: targetBehaviorType,
          actualBehaviorType: behavior.behaviorType,
          action,
        });
        return;
      }

      if (!behavior.instance) {
        this.reportSignalIssue('target Behavior instance missing (not created yet)', {
          entityId: entity.id,
          behaviorType: behavior.behaviorType,
          action,
        });
        return;
      }

      const directAction = (behavior.instance as unknown as Record<string, unknown>)[action];
      if (typeof directAction === 'function') {
        this.debug('action:invokeDirectMethod', {
          entityId: entity.id,
          behaviorType: behavior.behaviorType,
          action,
          args,
        });
        try {
          (directAction as (payload: Record<string, unknown>) => void).call(behavior.instance, args);
          this.debug('action:directMethodDone', {
            entityId: entity.id,
            behaviorType: behavior.behaviorType,
            action,
          });
        } catch (error) {
          this.reportSignalIssue('target Behavior direct action threw error', {
            entityId: entity.id,
            behaviorType: behavior.behaviorType,
            action,
            args,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }

      if (behavior.instance.onMessage) {
        this.debug('action:invokeOnMessage', {
          entityId: entity.id,
          behaviorType: behavior.behaviorType,
          action,
          args,
        });
        const handled = behavior.instance.onMessage(action, args);
        if (handled === false) {
          this.reportSignalIssue('target Behavior onMessage reported unhandled action', {
            entityId: entity.id,
            behaviorType: behavior.behaviorType,
            action,
            args,
          });
        } else {
          this.debug('action:onMessageHandled', {
            entityId: entity.id,
            behaviorType: behavior.behaviorType,
            action,
            handled,
          });
        }
      } else {
        this.reportSignalIssue('target Behavior action not found', {
          entityId: entity.id,
          behaviorType: behavior.behaviorType,
          action,
          args,
        });
      }
      return;
    }

    this.reportSignalIssue('unsupported target type', {
      entityId: entity.id,
      subTarget,
      action,
      args,
    });
  }

  private reportSignalIssue(reason: string, detail: Record<string, unknown>): void {
    sendDebugCommand({
      level: 'ERROR',
      source: 'SignalSystem',
      message: `rule/action issue: ${reason}`,
      detail,
    });
  }

  private debug(message: string, payload?: Record<string, unknown>): void {
    if (!DEBUG_SIGNAL_SYSTEM) return;
    sendDebugCommand({
      level: 'DEBUG',
      source: 'SignalSystem',
      message,
      detail: payload,
    });
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

  if (/[?:+\-*/=<>!]/.test(rawValue)) {
    try {
      const fn = new Function('payload', 'self', `return (${rawValue});`);
      return fn(payload, entity);
    } catch {
      // fallback to path resolve
    }
  }

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
