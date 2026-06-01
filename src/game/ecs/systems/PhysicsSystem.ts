import { System } from '../../types';
import type { 
  Entity, 
  TransformComponent, 
  RigidBodyComponent, 
  BoxColliderComponent,
  CircleColliderComponent,
  PolygonColliderComponent
} from '../../types';
import { PhysicsSystem as PhysicsEngine } from '../../../physics2D/PhysicsSystem';

/**
 * 物理系统 (ECS 桥接版)
 * 负责将 ECS 实体同步到物理引擎，并根据物理模拟结果更新 Transform
 */
export class EcsPhysicsSystem extends System {
  private engine: PhysicsEngine;
  private initializedEntities: Set<string | number> = new Set();
  private substeps: number;

  constructor(gravity = { x: 0, y: 0 }, substeps = 4) {
    super();
    this.engine = new PhysicsEngine(gravity);
    this.substeps = substeps;
  }

  update(entities: Entity[], _deltaTime: number): void {
    // 1. 同步实体到物理引擎 (处理新增或移除)
    this.syncEntitiesToEngine(entities);

    // 2. 执行物理步进
    this.engine.step(this.substeps);

    // 3. 将物理模拟结果同步回 Transform
    this.syncEngineToEntities(entities);
  }

  private syncEntitiesToEngine(entities: Entity[]): void {
    const currentEntityIds = new Set(entities.map(e => e.id));

    // 处理移除的实体
    for (const id of this.initializedEntities) {
      if (!currentEntityIds.has(id)) {
        this.engine.removeObject(id.toString());
        this.initializedEntities.delete(id);
      }
    }

    // 处理新增或更新的实体
    for (const entity of entities) {
      const rigidBody = entity.components.get('RigidBody') as RigidBodyComponent;
      const transform = entity.components.get('Transform') as TransformComponent;

      if (!rigidBody || !transform) continue;

      if (!this.initializedEntities.has(entity.id)) {
        this.createPhysicsBody(entity, rigidBody, transform);
        this.initializedEntities.add(entity.id);
      }
    }
  }

  private createPhysicsBody(entity: Entity, rb: RigidBodyComponent, tf: TransformComponent): void {
    const id = entity.id.toString();
    const isStatic = rb.bodyType === 'static';
    const options = {
      density: rb.density,
      friction: rb.friction,
      restitution: rb.restitution,
      bullet: rb.bullet,
      fixedRotation: rb.fixedRotation,
      gravityScale: rb.gravityScale,
    };

    // 检查碰撞体组件
    const boxCollider = entity.components.get('BoxCollider') as BoxColliderComponent;
    const circleCollider = entity.components.get('CircleCollider') as CircleColliderComponent;
    const polygonCollider = entity.components.get('PolygonCollider') as PolygonColliderComponent;

    if (boxCollider) {
      this.engine.createRectangle(
        id,
        tf.position.x + boxCollider.offset.x,
        tf.position.y + boxCollider.offset.y,
        boxCollider.width,
        boxCollider.height,
        isStatic,
        options
      );
    } else if (circleCollider) {
      this.engine.createCircle(
        id,
        tf.position.x + circleCollider.offset.x,
        tf.position.y + circleCollider.offset.y,
        circleCollider.radius,
        isStatic,
        options
      );
    } else if (polygonCollider) {
      this.engine.createPolygon(
        id,
        tf.position.x,
        tf.position.y,
        polygonCollider.points,
        isStatic,
        options
      );
    } else {
      // 默认创建一个小的圆形
      this.engine.createCircle(id, tf.position.x, tf.position.y, 10, isStatic, options);
    }

    // 设置初始速度
    this.engine.setLinearVelocity(id, rb.linearVelocity.x, rb.linearVelocity.y);
  }

  private syncEngineToEntities(entities: Entity[]): void {
    const states = this.engine.getAllStates();
    const stateMap = new Map(states.map(s => [s.id, s]));

    for (const entity of entities) {
      const state = stateMap.get(entity.id.toString());
      if (state) {
        const transform = entity.components.get('Transform') as TransformComponent;
        const rigidBody = entity.components.get('RigidBody') as RigidBodyComponent;

        if (transform) {
          transform.position.x = state.x;
          transform.position.y = state.y;
          transform.rotation = state.rotation;
        }

        // 也可以同步速度回 RigidBody 组件，如果需要的话
        if (rigidBody) {
          // 注意：PhysicsSystem.getAllStates 目前没有返回速度，
          // 如果需要，可以调用 getDetailedState
          const detailed = this.engine.getDetailedState(entity.id.toString());
          if (detailed) {
            rigidBody.linearVelocity.x = detailed.linearVelocity.x;
            rigidBody.linearVelocity.y = detailed.linearVelocity.y;
            rigidBody.angularVelocity = detailed.angularVelocity;
          }
        }
      }
    }
  }

  getEngine(): PhysicsEngine {
    return this.engine;
  }
}
