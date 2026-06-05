import { DigitCycleBehavior } from './behaviors/DigitCycleBehavior';
import { LightBehavior } from './behaviors/LightBehavior';
import { SwitchBehavior } from './behaviors/SwitchBehavior';
import { EcsAnimationSystem } from './modules/animation/AnimationSystem';
import { EcsBehaviorSystem } from './modules/behavior/BehaviorSystem';
import { EcsGameObjectLifecycleSystem } from './modules/lifecycle/GameObjectLifecycleSystem';
import { EcsInputSystem } from './modules/input/InputSystem';
import { EcsParticleSystem } from './modules/particles/ParticleSystem';
import { EcsPhysicsSystem } from './modules/physics/PhysicsSystem';
import { EcsRenderSystem } from './modules/rendering/RenderSystem';
import { EcsSignalSystem } from './modules/signals/SignalSystem';
import { EcsTimerSystem } from './modules/timer/TimerSystem';
import { GameEngine } from './core/GameEngine';
import { GameObjectRegistry } from './core/GameObjectRegistry';
import type { PixiCommandProcessor } from '../pixiJSRenderer/PixiCommandProcessor';

export interface RegisterDefaultSystemsOptions {
  processor: PixiCommandProcessor;
  gravity?: { x: number; y: number };
  substeps?: number;
}

/**
 * 统一入口：注册内置组件（当前组件由 XmlParser 内置支持，这里保留统一初始化接口）
 */
export function registerDefaultComponents(): void {
  // Intentionally empty.
}

/**
 * 统一入口：注册内置行为实现
 */
export function registerDefaultBehaviors(): void {
  GameObjectRegistry.register('DigitCycle', (entity, params) => new DigitCycleBehavior(entity, params));
  GameObjectRegistry.register('Switch', (entity, params) => new SwitchBehavior(entity, params));
  GameObjectRegistry.register('Light', (entity, params) => new LightBehavior(entity, params));
  GameObjectRegistry.register('SwitchBehavior', (entity, params) => new SwitchBehavior(entity, params));
  GameObjectRegistry.register('LightBehavior', (entity, params) => new LightBehavior(entity, params));
}

/**
 * 统一入口：注册默认系统工厂
 */
export function registerDefaultSystems(options: RegisterDefaultSystemsOptions): void {
  const { processor, gravity = { x: 0, y: 0 }, substeps = 4 } = options;

  GameEngine.registerSystem('PhysicsSystem', () => new EcsPhysicsSystem(gravity, substeps));
  GameEngine.registerSystem('RenderSystem', () => new EcsRenderSystem(processor));
  GameEngine.registerSystem('ParticleSystem', () => new EcsParticleSystem(processor));
  GameEngine.registerSystem('InputSystem', () => new EcsInputSystem());
  GameEngine.registerSystem('SignalSystem', () => new EcsSignalSystem());
  GameEngine.registerSystem('GameObjectLifecycleSystem', () => new EcsGameObjectLifecycleSystem());
  GameEngine.registerSystem('BehaviorSystem', () => new EcsBehaviorSystem());
  GameEngine.registerSystem('TimerSystem', () => new EcsTimerSystem());
  GameEngine.registerSystem('AnimationSystem', () => new EcsAnimationSystem());
}

/**
 * 一次性完成默认组件、行为、系统注册
 */
export function setupDefaultGame(options: RegisterDefaultSystemsOptions): void {
  registerDefaultComponents();
  registerDefaultBehaviors();
  registerDefaultSystems(options);
}
