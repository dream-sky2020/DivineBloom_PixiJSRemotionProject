/**
 * ECS 核心类型定义
 */

import type { TransformComponent } from './modules/transform/Transform';
import type { SpriteComponent } from './modules/rendering/Sprite';
import type { RigidBodyComponent } from './modules/physics/RigidBody';
import type { CircleColliderComponent, PolygonColliderComponent } from './modules/physics/Colliders';
import type { GraphicComponent } from './modules/rendering/Graphic';
import type { CameraComponent } from './modules/rendering/Camera';
import type { CanvasComponent } from './modules/rendering/Canvas';
import type { ParticleEmitterComponent } from './modules/particles/ParticleEmitter';
import type { TimerComponent } from './modules/timer/Timer';
import type { AnimationComponent, AnimationLabel, AnimationTrack, AnimationKeyframe } from './modules/animation/Animation';
import type {
  GameObjectControllerActionName,
  GameObjectControllerComponent,
} from './modules/lifecycle/GameObjectController';

export type { 
  TransformComponent, 
  SpriteComponent, 
  RigidBodyComponent,
  CircleColliderComponent,
  PolygonColliderComponent,
  GraphicComponent,
  CameraComponent,
  CanvasComponent,
  ParticleEmitterComponent,
  GameObjectControllerComponent,
  GameObjectControllerActionName,
  TimerComponent,
  AnimationComponent,
  AnimationLabel,
  AnimationTrack,
  AnimationKeyframe,
};

export type EntityId = string | number;

export interface Component {
  readonly type: string;
}

export interface BoxColliderComponent extends Component {
  readonly type: 'BoxCollider';
  width: number;
  height: number;
  offset: { x: number; y: number };
}

export interface SignalActionRule {
  kind: 'action';
  event: string; // 支持 LOCAL:, GLOBAL:, INTERFACE:
  target?: string; // 支持 GameObjectController, Behavior:[Type], ENTITY:[ID]/[SUB], INTERFACE:[Name]
  action?: string;
  emit?: string; // 新增：支持直接转发为另一个信号
  when?: string;
  args: Record<string, string | number | boolean>;
  priority: number;
}

export interface SignalEmitRule {
  kind: 'emit';
  from: string;
  emit: string;
  signal: string;
  when?: string;
  args: Record<string, string | number | boolean>;
  priority: number;
}

export type SignalBindingRule = SignalActionRule | SignalEmitRule;

export interface SignalInterfaceDefinition {
  name: string;
  internal: string; // 内部信号名或目标路径
  direction: 'in' | 'out';
}

export interface SignalConfigComponent extends Component {
  readonly type: 'SignalConfig';
  rules: SignalBindingRule[];
  interfaces?: SignalInterfaceDefinition[]; // Prefab 暴露的接口
}

export type InputActionType = 'button' | 'axis1' | 'axis2';

export interface InputActionDefinition {
  id: string;
  type: InputActionType;
}

export interface InputActionMapDefinition {
  id: string;
  enabled: boolean;
  actions: InputActionDefinition[];
}

export interface InputBindingPartDefinition {
  name: string;
  path: string;
}

export interface InputBindingDefinition {
  action: string;
  map?: string;
  path?: string;
  kind?: '2dComposite';
  processor?: string;
  parts: InputBindingPartDefinition[];
}

export interface InputConfig {
  mode: 'strict' | 'loose';
  devicePolicy: string[];
  deadzone: number;
  activeMap?: string;
  actionMaps: InputActionMapDefinition[];
  bindings: InputBindingDefinition[];
}

export type InputRoutePhase = 'pressed' | 'released' | 'held' | 'changed';

export interface InputRouteSetDefinition {
  key: string;
  from?: string;
  value?: string | number | boolean;
}

export interface InputRouteDefinition {
  action: string;
  map?: string;
  phase: InputRoutePhase;
  emit: string;
  throttleMs: number;
  sets: InputRouteSetDefinition[];
}

export interface InputToSignalMapConfig {
  defaultMap?: string;
  routes: InputRouteDefinition[];
}

export type AnyComponent = 
  | TransformComponent 
  | SpriteComponent 
  | RigidBodyComponent 
  | BoxColliderComponent
  | CircleColliderComponent
  | PolygonColliderComponent
  | GraphicComponent
  | CameraComponent
  | ParticleEmitterComponent
  | GameObjectControllerComponent
  | SignalConfigComponent
  | BehaviorComponent
  | TimerComponent
  | AnimationComponent;

/**
 * 自定义 GameObject 接口，用于在 ECS 之外实现复杂的逻辑
 */
export interface GameObject {
  readonly entity: Entity;
  
  /**
   * 初始化时调用
   */
  onAwake?(): void;

  /**
   * 每帧更新逻辑
   */
  onUpdate?(deltaTime: number): void;

  /**
   * 通信协议：处理自定义消息
   */
  onMessage?(message: string, payload: any): boolean | void;

  /**
   * 销毁时调用
   */
  onDestroy?(): void;

  /**
   * 发送信号的辅助方法
   */
  emit?(signal: string, payload?: any): void;
}

export interface BehaviorComponent extends Component {
  readonly type: 'Behavior';
  behaviorType: string;
  instance?: GameObject;
  params: Record<string, any>;
}

export interface Entity {
  id: EntityId;
  name?: string;
  components: Map<string, AnyComponent>;
}

export abstract class System {
  abstract update(entities: Entity[], deltaTime: number): void;
  configure?(_config: EngineConfig): void;
  bindWorldData?(_worldData: WorldData): void;
}

export interface SystemConfig {
  name: string;
  enabled: boolean;
}

export interface EngineConfig {
  systems: SystemConfig[];
  inputConfig?: InputConfig;
  inputToSignalMap?: InputToSignalMapConfig;
}

export interface WorldData {
  config: EngineConfig;
  canvas?: CanvasComponent;
  entities: Entity[];
}
