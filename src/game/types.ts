/**
 * ECS 核心类型定义
 */

import type { TransformComponent } from './ecs/components/Transform';
import type { SpriteComponent } from './ecs/components/Sprite';
import type { RigidBodyComponent } from './ecs/components/RigidBody';
import type { CircleColliderComponent } from './ecs/components/CircleCollider';
import type { PolygonColliderComponent } from './ecs/components/PolygonCollider';
import type { GraphicComponent } from './ecs/components/Graphic';
import type { CameraComponent } from './ecs/components/Camera';
import type { CanvasComponent } from './ecs/components/Canvas';
import type { ParticleEmitterComponent } from './ecs/components/ParticleEmitter';
import type { TimerComponent } from './ecs/components/Timer';
import type { AnimationComponent, AnimationLabel, AnimationTrack, AnimationKeyframe } from './ecs/components/Animation';
import type {
  GameObjectControllerActionName,
  GameObjectControllerComponent,
} from './ecs/components/GameObjectController';

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
  event: string;
  target: string;
  action: string;
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

export interface SignalConfigComponent extends Component {
  readonly type: 'SignalConfig';
  rules: SignalBindingRule[];
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
  onMessage?(message: string, payload: any): void;

  /**
   * 销毁时调用
   */
  onDestroy?(): void;
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
