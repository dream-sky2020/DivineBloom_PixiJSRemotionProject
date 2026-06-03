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
import type { AnimationsComponent } from './ecs/components/Animations';
import type { AnimationActionName, AnimationControllerComponent } from './ecs/components/AnimationController';

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
  AnimationsComponent,
  AnimationControllerComponent,
  AnimationActionName,
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

export interface SignalBindingRule {
  event: string;
  target: string;
  action: string;
  when?: string;
  args: Record<string, string | number | boolean>;
  priority: number;
}

export interface SignalBindingsComponent extends Component {
  readonly type: 'SignalBindings';
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
  | AnimationsComponent
  | AnimationControllerComponent
  | SignalBindingsComponent;

export interface Entity {
  id: EntityId;
  name?: string;
  components: Map<string, AnyComponent>;
}

export abstract class System {
  abstract update(entities: Entity[], deltaTime: number): void;
  configure?(_config: EngineConfig): void;
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
