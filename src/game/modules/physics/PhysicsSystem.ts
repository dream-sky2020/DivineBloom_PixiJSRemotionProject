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
} from '../transform/transformHierarchy';
import { isRigidBodyEmitName } from './RigidBody';
import { enqueueComponentEmitEvent, enqueueSignalEvent } from '../signals/signalRuntime';

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
    this.syncEntitiesToEngine(entities);
    this.engine.step(this.substeps);
    this.dispatchContactSignals(entities, this.engine.consumeContactEvents());
    this.syncEngineToEntities(entities);
  }

  private syncEntitiesToEngine(entities: Entity[]): void {
    const currentEntityIds = new Set(entities.map(e => e.id));
    const entityMap = createEntityMap(entities);
    const transformCache: TransformCache = new Map();

    for (const id of this.initializedEntities) {
      if (!currentEntityIds.has(id)) {
        this.engine.removeObject(id.toString());
        this.initializedEntities.delete(id);
      }
    }

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
      this.engine.createCircle(id, worldTransform.position.x, worldTransform.position.y, 10, isStatic, options);
    }

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

        if (rigidBody) {
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
