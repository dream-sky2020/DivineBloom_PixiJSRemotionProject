import { System } from '../../types';
import type {
  EngineConfig,
  Entity,
  InputActionDefinition,
  InputBindingDefinition,
  InputConfig,
  InputRouteDefinition,
  InputToSignalMapConfig,
} from '../../types';
import { enqueueSignalEvent } from '../signals/signalRuntime';

type ActionValue = boolean | number | { x: number; y: number };

interface SampleContext {
  device: string;
  path: string;
}

interface SignalEvent {
  id: string;
  payload: Record<string, unknown>;
}

export class EcsInputSystem extends System {
  private inputConfig?: InputConfig;
  private inputToSignalMap?: InputToSignalMapConfig;
  private attached = false;
  private pressedKeys = new Set<string>();
  private pressedMouseButtons = new Set<number>();
  private wheelDeltaY = 0;
  private currentValues = new Map<string, ActionValue>();
  private previousValues = new Map<string, ActionValue>();
  private routeLastEmitAt = new Map<string, number>();
  private actionSampleContext = new Map<string, SampleContext>();

  configure(config: EngineConfig): void {
    this.inputConfig = config.inputConfig;
    this.inputToSignalMap = config.inputToSignalMap;
  }

  update(_entities: Entity[], _deltaTime: number): void {
    if (!this.inputConfig || !this.inputToSignalMap) {
      return;
    }

    this.attachListenersOnce();
    const actionIndex = createActionIndex(this.inputConfig);
    if (actionIndex.size === 0) {
      return;
    }

    this.previousValues = new Map(this.currentValues);
    this.currentValues = new Map();
    this.actionSampleContext.clear();

    for (const binding of this.inputConfig.bindings) {
      const actionDef = actionIndex.get(binding.action);
      if (!actionDef) {
        if (this.inputConfig.mode === 'strict') {
          throw new Error(`InputConfig: Unknown action "${binding.action}" in <Binding>`);
        }
        continue;
      }

      const sample = this.sampleBinding(binding, actionDef.type, this.inputConfig.deadzone);
      if (!sample) continue;
      this.accumulateActionValue(binding.action, actionDef.type, sample.value);
      if (sample.active) {
        this.actionSampleContext.set(binding.action, {
          device: sample.device,
          path: sample.path,
        });
      }
    }

    const signals: SignalEvent[] = [];
    const now = Date.now();
    for (const route of this.inputToSignalMap.routes) {
      const current = this.currentValues.get(route.action) ?? defaultValueForType(actionIndex.get(route.action)?.type);
      const previous = this.previousValues.get(route.action) ?? defaultValueForType(actionIndex.get(route.action)?.type);
      if (!shouldEmitRoute(route, previous, current)) continue;

      if (route.throttleMs > 0) {
        const routeKey = `${route.map || this.inputToSignalMap.defaultMap || ''}:${route.action}:${route.phase}:${route.emit}`;
        const last = this.routeLastEmitAt.get(routeKey) ?? 0;
        if (now - last < route.throttleMs) continue;
        this.routeLastEmitAt.set(routeKey, now);
      }

      signals.push({
        id: route.emit,
        payload: this.buildPayload(route, route.action, current, now),
      });
    }

    if (signals.length > 0) this.dispatchSignals(signals);

    this.wheelDeltaY = 0;
  }

  private attachListenersOnce(): void {
    if (this.attached || typeof window === 'undefined') return;
    this.attached = true;

    window.addEventListener('keydown', (event) => {
      this.pressedKeys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.pressedKeys.delete(event.code);
    });
    window.addEventListener('mousedown', (event) => {
      this.pressedMouseButtons.add(event.button);
    });
    window.addEventListener('mouseup', (event) => {
      this.pressedMouseButtons.delete(event.button);
    });
    window.addEventListener(
      'wheel',
      (event) => {
        this.wheelDeltaY += event.deltaY;
      },
      { passive: true },
    );
  }

  private sampleBinding(
    binding: InputBindingDefinition,
    actionType: InputActionDefinition['type'],
    deadzone: number,
  ): { value: ActionValue; active: boolean; device: string; path: string } | undefined {
    if (binding.kind === '2dComposite') {
      const up = this.readButtonPath(findPartPath(binding, 'up')) ? 1 : 0;
      const down = this.readButtonPath(findPartPath(binding, 'down')) ? 1 : 0;
      const left = this.readButtonPath(findPartPath(binding, 'left')) ? 1 : 0;
      const right = this.readButtonPath(findPartPath(binding, 'right')) ? 1 : 0;
      const value = { x: right - left, y: down - up };
      const active = Math.abs(value.x) > 0 || Math.abs(value.y) > 0;
      return {
        value,
        active,
        device: 'keyboard',
        path: 'Keyboard/Composite2D',
      };
    }

    if (!binding.path) return undefined;
    const path = binding.path.trim();
    if (!path) return undefined;

    if (actionType === 'button') {
      const pressed = this.readButtonPath(path);
      return {
        value: pressed,
        active: pressed,
        device: path.split('/')[0] || 'unknown',
        path,
      };
    }

    if (actionType === 'axis1') {
      let value = this.readAxis1Path(path);
      value = applyProcessor(value, binding.processor);
      if (Math.abs(value) < deadzone) value = 0;
      return {
        value,
        active: value !== 0,
        device: path.split('/')[0] || 'unknown',
        path,
      };
    }

    let vector = this.readAxis2Path(path);
    vector = applyVectorProcessor(vector, binding.processor);
    if (Math.abs(vector.x) < deadzone) vector.x = 0;
    if (Math.abs(vector.y) < deadzone) vector.y = 0;
    return {
      value: vector,
      active: vector.x !== 0 || vector.y !== 0,
      device: path.split('/')[0] || 'unknown',
      path,
    };
  }

  private readButtonPath(path?: string): boolean {
    if (!path) return false;
    const [deviceRaw, controlRaw] = path.split('/');
    const device = (deviceRaw || '').toLowerCase();
    const control = (controlRaw || '').trim();

    if (device === 'keyboard') {
      const code = normalizeKeyboardCode(control);
      return code ? this.pressedKeys.has(code) : false;
    }
    if (device === 'mouse') {
      const buttonIndex = normalizeMouseButton(control);
      return buttonIndex >= 0 ? this.pressedMouseButtons.has(buttonIndex) : false;
    }
    if (device === 'gamepad') {
      const gamepad = getFirstConnectedGamepad();
      if (!gamepad) return false;
      if (control.toLowerCase() === 'south') {
        return !!gamepad.buttons[0]?.pressed;
      }
    }
    return false;
  }

  private readAxis1Path(path: string): number {
    const [deviceRaw, controlRaw] = path.split('/');
    const device = (deviceRaw || '').toLowerCase();
    const control = (controlRaw || '').trim().toLowerCase();

    if (device === 'mouse' && control === 'wheely') {
      return this.wheelDeltaY;
    }
    if (device === 'gamepad' && control === 'lefttrigger') {
      const gamepad = getFirstConnectedGamepad();
      return gamepad?.buttons[6]?.value ?? 0;
    }
    return 0;
  }

  private readAxis2Path(path: string): { x: number; y: number } {
    const [deviceRaw, controlRaw] = path.split('/');
    const device = (deviceRaw || '').toLowerCase();
    const control = (controlRaw || '').trim().toLowerCase();

    if (device === 'gamepad' && control === 'leftstick') {
      const gamepad = getFirstConnectedGamepad();
      if (!gamepad) return { x: 0, y: 0 };
      return {
        x: gamepad.axes[0] ?? 0,
        y: gamepad.axes[1] ?? 0,
      };
    }
    return { x: 0, y: 0 };
  }

  private accumulateActionValue(action: string, type: InputActionDefinition['type'], sampled: ActionValue): void {
    const existing = this.currentValues.get(action);
    if (!existing) {
      this.currentValues.set(action, sampled);
      return;
    }

    if (type === 'button') {
      this.currentValues.set(action, Boolean(existing) || Boolean(sampled));
      return;
    }
    if (type === 'axis1') {
      this.currentValues.set(action, (existing as number) + (sampled as number));
      return;
    }

    this.currentValues.set(action, {
      x: (existing as { x: number; y: number }).x + (sampled as { x: number; y: number }).x,
      y: (existing as { x: number; y: number }).y + (sampled as { x: number; y: number }).y,
    });
  }

  private buildPayload(
    route: InputRouteDefinition,
    action: string,
    value: ActionValue,
    now: number,
  ): Record<string, unknown> {
    const context = this.actionSampleContext.get(action);
    const payload: Record<string, unknown> = {
      action,
      value,
      time: now,
      device: context?.device || 'unknown',
      path: context?.path || '',
    };

    for (const set of route.sets) {
      if (set.from) {
        payload[set.key] = resolveCtxPath(set.from, payload);
      } else if (set.value !== undefined) {
        payload[set.key] = set.value;
      }
    }
    return payload;
  }

  private dispatchSignals(events: SignalEvent[]): void {
    for (const signal of events) {
      let isGlobal = false;
      let signalName = signal.id.trim();

      if (signalName.startsWith('GLOBAL:')) {
        isGlobal = true;
        signalName = signalName.slice('GLOBAL:'.length);
      } else if (signalName.startsWith('LOCAL:')) {
        isGlobal = false;
        signalName = signalName.slice('LOCAL:'.length);
      }

      enqueueSignalEvent({
        id: signalName,
        payload: signal.payload,
        isGlobal,
      });
    }
  }
}

function createActionIndex(inputConfig: InputConfig): Map<string, InputActionDefinition> {
  const index = new Map<string, InputActionDefinition>();
  for (const map of inputConfig.actionMaps) {
    for (const action of map.actions) {
      index.set(action.id, action);
    }
  }
  return index;
}

function shouldEmitRoute(route: InputRouteDefinition, previous: ActionValue, current: ActionValue): boolean {
  switch (route.phase) {
    case 'pressed':
      return !asBoolean(previous) && asBoolean(current);
    case 'released':
      return asBoolean(previous) && !asBoolean(current);
    case 'held':
      return asBoolean(current);
    case 'changed':
      return !actionValueEquals(previous, current);
    default:
      return false;
  }
}

function asBoolean(value: ActionValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return value.x !== 0 || value.y !== 0;
}

function actionValueEquals(left: ActionValue, right: ActionValue): boolean {
  if (typeof left !== typeof right) return false;
  if (typeof left === 'boolean' || typeof left === 'number') return left === right;
  return left.x === (right as { x: number; y: number }).x && left.y === (right as { x: number; y: number }).y;
}

function defaultValueForType(type?: InputActionDefinition['type']): ActionValue {
  if (type === 'axis1') return 0;
  if (type === 'axis2') return { x: 0, y: 0 };
  return false;
}

function findPartPath(binding: InputBindingDefinition, partName: string): string | undefined {
  return binding.parts.find((part) => part.name.toLowerCase() === partName.toLowerCase())?.path;
}

function normalizeKeyboardCode(raw: string): string | undefined {
  const token = raw.trim();
  if (!token) return undefined;
  if (token.length === 1 && /[a-zA-Z]/.test(token)) {
    return `Key${token.toUpperCase()}`;
  }
  const aliases: Record<string, string> = {
    space: 'Space',
    enter: 'Enter',
    escape: 'Escape',
    esc: 'Escape',
    tab: 'Tab',
  };
  return aliases[token.toLowerCase()] || token;
}

function normalizeMouseButton(raw: string): number {
  const token = raw.trim().toLowerCase();
  if (token === 'leftbutton') return 0;
  if (token === 'middlebutton') return 1;
  if (token === 'rightbutton') return 2;
  return -1;
}

function getFirstConnectedGamepad(): Gamepad | undefined {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return undefined;
  }
  const gamepads = navigator.getGamepads();
  for (const gamepad of gamepads) {
    if (gamepad) return gamepad;
  }
  return undefined;
}

function applyProcessor(value: number, processor?: string): number {
  if (!processor) return value;
  const scale = parseScaleProcessor(processor);
  if (scale === undefined) return value;
  return value * scale;
}

function applyVectorProcessor(value: { x: number; y: number }, processor?: string): { x: number; y: number } {
  if (!processor) return value;
  const scale = parseScaleProcessor(processor);
  if (scale === undefined) return value;
  return {
    x: value.x * scale,
    y: value.y * scale,
  };
}

function parseScaleProcessor(processor: string): number | undefined {
  const match = processor.trim().match(/^scale\(\s*(-?\d*\.?\d+)\s*\)$/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveCtxPath(path: string, payload: Record<string, unknown>): unknown {
  const normalized = path.trim();
  if (!normalized.startsWith('ctx.')) {
    return undefined;
  }
  const segments = normalized.slice(4).split('.');
  let cursor: unknown = payload;
  for (const segment of segments) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}
