import { System } from '../../types';
import type { 
  Entity, 
  TransformComponent, 
  RigidBodyComponent, 
  BoxColliderComponent,
  CircleColliderComponent,
  PolygonColliderComponent,
} from '../../types';
import { PhysicsSystem as PhysicsEngine } from '../../../physics2D/PhysicsSystem';
import type { PhysicsContactEvent } from '../../../physics2D/PhysicsSystem';
import {
  createEntityMap,
  resolveWorldTransform,
  worldToLocalPosition,
  type TransformCache,
} from '../utils/transformHierarchy';
import { isRigidBodyEmitName } from '../components/RigidBody';
import { enqueueComponentEmitEvent, enqueueSignalEvent } from '../signalRuntime';

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
    this.dispatchContactSignals(entities, this.engine.consumeContactEvents());

    // 3. 将物理模拟结果同步回 Transform
    this.syncEngineToEntities(entities);
  }

  private syncEntitiesToEngine(entities: Entity[]): void {
    const currentEntityIds = new Set(entities.map(e => e.id));
    const entityMap = createEntityMap(entities);
    const transformCache: TransformCache = new Map();

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
        this.createPhysicsBody(entity, rigidBody, transform, entityMap, transformCache);
        this.initializedEntities.add(entity.id);
      }
    }
  }

  private createPhysicsBody(
    entity: Entity,
    rb: RigidBodyComponent,
    tf: TransformComponent,
    entityMap: Map<string, Entity>,
    transformCache: TransformCache,
  ): void {
    const id = entity.id.toString();
    const worldTransform = resolveWorldTransform(entity, entityMap, transformCache) || {
      position: { ...tf.position },
      rotation: tf.rotation,
      scale: { ...tf.scale },
    };
    const isStatic = rb.bodyType === 'static';
    const options = {
      density: rb.density,
      friction: rb.friction,
      restitution: rb.restitution,
      bullet: rb.bullet,
      sensor: rb.sensor,
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
        worldTransform.position.x + boxCollider.offset.x,
        worldTransform.position.y + boxCollider.offset.y,
        boxCollider.width,
        boxCollider.height,
        isStatic,
        options
      );
    } else if (circleCollider) {
      this.engine.createCircle(
        id,
        worldTransform.position.x + circleCollider.offset.x,
        worldTransform.position.y + circleCollider.offset.y,
        circleCollider.radius,
        isStatic,
        options
      );
    } else if (polygonCollider) {
      this.engine.createPolygon(
        id,
        worldTransform.position.x,
        worldTransform.position.y,
        polygonCollider.points,
        isStatic,
        options
      );
    } else {
      // 默认创建一个小的圆形
      this.engine.createCircle(id, worldTransform.position.x, worldTransform.position.y, 10, isStatic, options);
    }

    // 设置初始速度
    this.engine.setLinearVelocity(id, rb.linearVelocity.x, rb.linearVelocity.y);
  }

  private syncEngineToEntities(entities: Entity[]): void {
    const states = this.engine.getAllStates();
    const stateMap = new Map(states.map(s => [s.id, s]));
    const entityMap = createEntityMap(entities);
    const transformCache: TransformCache = new Map();

    for (const entity of entities) {
      const state = stateMap.get(entity.id.toString());
      if (state) {
        const transform = entity.components.get('Transform') as TransformComponent;
        const rigidBody = entity.components.get('RigidBody') as RigidBodyComponent;

        if (transform) {
          const local = worldToLocalPosition(
            entity,
            { x: state.x, y: state.y, z: transform.position.z },
            entityMap,
            transformCache,
          );
          transform.position.x = local.x;
          transform.position.y = local.y;
          transform.position.z = local.z;
          transform.rotation = state.rotation;
          transformCache.delete(entity.id.toString());
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

  private dispatchContactSignals(entities: Entity[], contacts: PhysicsContactEvent[]): void {
    if (contacts.length === 0) return;

    const entityById = new Map(entities.map((entity) => [String(entity.id), entity]));
    for (const contact of contacts) {
      const payload = {
        selfId: contact.selfId,
        otherId: contact.otherId,
        phase: contact.phase,
      };

      // 兼容旧规则：On event="physics.overlap.*"
      enqueueSignalEvent({
        id: `physics.overlap.${contact.phase}`,
        payload,
        scopeSelfId: String(contact.selfId),
      });

      const selfEntity = entityById.get(String(contact.selfId));
      if (!selfEntity) continue;
      const rigidBody = selfEntity.components.get('RigidBody') as RigidBodyComponent | undefined;
      if (!rigidBody) continue;
      if (!rigidBody.sensor) continue;
      const emitName = `sensor.${contact.phase}`;
      if (!isRigidBodyEmitName(emitName)) continue;
      if (!rigidBody.allowedEmits.includes(emitName)) continue;
      enqueueComponentEmitEvent({
        sourceEntityId: String(contact.selfId),
        from: 'RigidBody',
        emit: emitName,
        payload: {
          ...payload,
        },
      });
    }
  }
}
