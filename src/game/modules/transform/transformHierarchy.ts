import type { Entity, TransformComponent } from '../../types';

export interface ResolvedTransform {
  position: { x: number; y: number; z: number };
  rotation: number;
  scale: { x: number; y: number; z: number };
}

export type EntityMap = Map<string, Entity>;
export type TransformCache = Map<string, ResolvedTransform>;

export function createEntityMap(entities: Entity[]): EntityMap {
  return new Map(entities.map((entity) => [String(entity.id), entity]));
}

export function resolveWorldTransform(
  entity: Entity,
  entityMap: EntityMap,
  cache: TransformCache,
  visiting = new Set<string>(),
): ResolvedTransform | null {
  const id = String(entity.id);
  const cached = cache.get(id);
  if (cached) {
    return cached;
  }

  const local = entity.components.get('Transform') as TransformComponent | undefined;
  if (!local) {
    return null;
  }

  const parentId = local.parent?.toString();
  if (!parentId || parentId === id) {
    const resolved = cloneTransform(local);
    cache.set(id, resolved);
    return resolved;
  }

  if (visiting.has(id)) {
    console.warn(`Transform hierarchy cycle detected at entity: ${id}`);
    const resolved = cloneTransform(local);
    cache.set(id, resolved);
    return resolved;
  }

  visiting.add(id);
  const parentEntity = entityMap.get(parentId);
  const parentWorld = parentEntity ? resolveWorldTransform(parentEntity, entityMap, cache, visiting) : null;
  visiting.delete(id);

  if (!parentWorld) {
    const resolved = cloneTransform(local);
    cache.set(id, resolved);
    return resolved;
  }

  const resolved: ResolvedTransform = {
    position: {
      x: parentWorld.position.x + local.position.x,
      y: parentWorld.position.y + local.position.y,
      z: parentWorld.position.z + local.position.z,
    },
    rotation: parentWorld.rotation + local.rotation,
    scale: {
      x: parentWorld.scale.x * local.scale.x,
      y: parentWorld.scale.y * local.scale.y,
      z: parentWorld.scale.z * local.scale.z,
    },
  };
  cache.set(id, resolved);
  return resolved;
}

export function worldToLocalPosition(
  entity: Entity,
  worldPosition: { x: number; y: number; z: number },
  entityMap: EntityMap,
  cache: TransformCache,
): { x: number; y: number; z: number } {
  const transform = entity.components.get('Transform') as TransformComponent | undefined;
  if (!transform?.parent) {
    return { ...worldPosition };
  }

  const parentEntity = entityMap.get(transform.parent.toString());
  if (!parentEntity) {
    return { ...worldPosition };
  }

  const parentWorld = resolveWorldTransform(parentEntity, entityMap, cache);
  if (!parentWorld) {
    return { ...worldPosition };
  }

  return {
    x: worldPosition.x - parentWorld.position.x,
    y: worldPosition.y - parentWorld.position.y,
    z: worldPosition.z - parentWorld.position.z,
  };
}

function cloneTransform(transform: TransformComponent): ResolvedTransform {
  return {
    position: { ...transform.position },
    rotation: transform.rotation,
    scale: { ...transform.scale },
  };
}
