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

export type { 
  TransformComponent, 
  SpriteComponent, 
  RigidBodyComponent,
  CircleColliderComponent,
  PolygonColliderComponent,
  GraphicComponent,
  CameraComponent,
  CanvasComponent
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

export type AnyComponent = 
  | TransformComponent 
  | SpriteComponent 
  | RigidBodyComponent 
  | BoxColliderComponent
  | CircleColliderComponent
  | PolygonColliderComponent
  | GraphicComponent
  | CameraComponent;

export interface Entity {
  id: EntityId;
  name?: string;
  components: Map<string, AnyComponent>;
}

export abstract class System {
  abstract update(entities: Entity[], deltaTime: number): void;
}

export interface SystemConfig {
  name: string;
  enabled: boolean;
}

export interface EngineConfig {
  systems: SystemConfig[];
}

export interface WorldData {
  config: EngineConfig;
  canvas?: CanvasComponent;
  entities: Entity[];
}
