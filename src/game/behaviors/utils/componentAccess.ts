import type { AnyComponent, Entity } from '../../types';
import { sendDebugCommand } from '../../../debug/DebugLogger';

interface ComponentAccessorOptions {
  required?: boolean;
}

export interface BehaviorComponentAccessor {
  getComponent<T extends AnyComponent = AnyComponent>(
    componentType: string,
    options?: ComponentAccessorOptions,
  ): T | undefined;
  setProperty(componentType: string, propertyPath: string, value: unknown): boolean;
  reportIssue(reason: string, detail?: Record<string, unknown>): void;
}

export function createBehaviorComponentAccessor(
  entity: Entity,
  behaviorType: string,
  params: Record<string, any>,
): BehaviorComponentAccessor {
  const debug = (message: string, detail?: Record<string, unknown>): void => {
    sendDebugCommand({
      level: 'DEBUG',
      source: 'BehaviorAccess',
      message,
      detail: {
      entityId: entity.id,
      behaviorType,
        ...detail,
      },
    });
  };

  const reportIssue = (reason: string, detail?: Record<string, unknown>): void => {
    sendDebugCommand({
      level: 'ERROR',
      source: 'BehaviorAccess',
      message: `component/property control issue: ${reason}`,
      detail: {
        entityId: entity.id,
        behaviorType,
        params,
        detail,
      },
    });
  };

  const getComponent = <T extends AnyComponent = AnyComponent>(
    componentType: string,
    options: ComponentAccessorOptions = {},
  ): T | undefined => {
    const component = entity.components.get(componentType) as T | undefined;
    if (component) {
      debug('getComponent:hit', { componentType });
    }
    if (!component && options.required) {
      reportIssue('missing required component', {
        componentType,
        availableComponents: Array.from(entity.components.keys()),
      });
      debug('getComponent:miss', { componentType, required: true });
    }
    return component;
  };

  const setProperty = (componentType: string, propertyPath: string, value: unknown): boolean => {
    debug('setProperty:start', { componentType, propertyPath, nextValue: value });
    const component = getComponent<Record<string, unknown> & AnyComponent>(componentType, { required: true });
    if (!component) return false;

    const segments = propertyPath.split('.').map((segment) => segment.trim()).filter(Boolean);
    if (segments.length === 0) {
      reportIssue('empty property path', { componentType, propertyPath });
      return false;
    }

    let cursor: Record<string, unknown> = component;
    for (let i = 0; i < segments.length - 1; i++) {
      const key = segments[i];
      if (!(key in cursor)) {
        reportIssue('missing nested property', {
          componentType,
          propertyPath,
          missingAt: key,
          availableKeys: Object.keys(cursor),
        });
        return false;
      }

      const next = cursor[key];
      if (!next || typeof next !== 'object') {
        reportIssue('nested property is not an object', {
          componentType,
          propertyPath,
          invalidAt: key,
          actualValue: next,
        });
        return false;
      }
      cursor = next as Record<string, unknown>;
    }

    const finalKey = segments[segments.length - 1];
    if (!(finalKey in cursor)) {
      reportIssue('missing target property', {
        componentType,
        propertyPath,
        missingAt: finalKey,
        availableKeys: Object.keys(cursor),
      });
      return false;
    }

    const previousValue = cursor[finalKey];
    cursor[finalKey] = value;
    debug('setProperty:success', {
      componentType,
      propertyPath,
      previousValue,
      nextValue: value,
    });
    return true;
  };

  return {
    getComponent,
    setProperty,
    reportIssue,
  };
}
