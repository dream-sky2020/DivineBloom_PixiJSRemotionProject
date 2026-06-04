import type { StagePrimitive } from './types';

export interface AnimationFunctionContext {
  vars: Record<string, StagePrimitive>;
  arg: Record<string, unknown>;
  ctx: {
    scriptId: string;
    instanceId: string;
    localFrame: number;
  };
  role: Record<string, string>;
}

export type AnimationFunction = (
  args: Array<StagePrimitive | undefined>,
  context: AnimationFunctionContext,
) => StagePrimitive | undefined;

interface RegisteredAnimationFunction {
  fn: AnimationFunction;
  timeoutMs?: number;
}

const registry = new Map<string, RegisteredAnimationFunction>();

export function registerAnimationFunction(
  id: string,
  fn: AnimationFunction,
  timeoutMs?: number,
): void {
  const normalized = id.trim();
  if (!normalized) {
    throw new Error('registerAnimationFunction: id cannot be empty');
  }
  if (registry.has(normalized)) {
    throw new Error(`registerAnimationFunction: duplicate id "${normalized}"`);
  }
  registry.set(normalized, {
    fn,
    timeoutMs: typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) ? timeoutMs : undefined,
  });
}

export function unregisterAnimationFunction(id: string): void {
  registry.delete(id.trim());
}

export function clearAnimationFunctionRegistry(): void {
  registry.clear();
}

export function hasAnimationFunction(id: string): boolean {
  return registry.has(id.trim());
}

export function callAnimationFunction(
  id: string,
  args: Array<StagePrimitive | undefined>,
  context: AnimationFunctionContext,
): StagePrimitive | undefined {
  const normalized = id.trim();
  const entry = registry.get(normalized);
  if (!entry) {
    throw new Error(`Animation function not found: ${normalized}`);
  }
  const startedAt = Date.now();
  const result = entry.fn(args, context);
  const timeoutMs = entry.timeoutMs;
  if (typeof timeoutMs === 'number' && timeoutMs >= 0 && Date.now() - startedAt > timeoutMs) {
    throw new Error(`Animation function timeout: ${normalized}`);
  }
  return result;
}
