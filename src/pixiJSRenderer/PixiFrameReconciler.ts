import type {
  PixiCreateCommand,
  PixiDestroyCommand,
  PixiDoubleBufferedFrameState,
  PixiFrameObjectState,
  PixiReadonlyFrameStateMap,
  PixiReconcilerInput,
  PixiRendererCommand,
  PixiRendererObjectId,
  PixiUpdateCommand,
} from './types';

type PlainObject = Record<string, unknown>;

export class PixiFrameReconciler {
  private readonly buffers: PixiDoubleBufferedFrameState = {
    current: new Map(),
    next: new Map(),
  };

  public beginFrame() {
    this.buffers.next.clear();
    return this.buffers.next;
  }

  public setObject(state: PixiFrameObjectState) {
    this.buffers.next.set(state.id, cloneFrameObjectState(state));
  }

  public removeObject(id: PixiRendererObjectId) {
    this.buffers.next.delete(id);
  }

  public reconcile(input?: PixiReconcilerInput) {
    if (input) {
      this.replaceNextFrame(input.objects);
    }

    const commands = reconcilePixiFrameStates(this.buffers.current, this.buffers.next);
    this.swapBuffers();
    return commands;
  }

  public reset() {
    this.buffers.current.clear();
    this.buffers.next.clear();
  }

  public getCurrentFrameState(): PixiReadonlyFrameStateMap {
    return this.buffers.current;
  }

  public getNextFrameState() {
    return this.buffers.next;
  }

  private replaceNextFrame(objects: PixiReadonlyFrameStateMap) {
    const nextObjects = [...objects.values()];
    this.buffers.next.clear();

    for (const object of nextObjects) {
      this.setObject(object);
    }
  }

  private swapBuffers() {
    const oldCurrent = this.buffers.current;
    this.buffers.current = this.buffers.next;
    this.buffers.next = oldCurrent;
    this.buffers.next.clear();
  }
}

export function reconcilePixiFrameStates(
  current: PixiReadonlyFrameStateMap,
  next: PixiReadonlyFrameStateMap,
): PixiRendererCommand[] {
  const commands: PixiRendererCommand[] = [];
  const destroyStates: PixiFrameObjectState[] = [];
  const createStates: PixiFrameObjectState[] = [];
  const updateCommands: PixiUpdateCommand[] = [];
  const forcedParticleUpdates = new Set<PixiRendererObjectId>();
  const removedContainerIds = collectRemovedContainerIds(current, next);

  for (const currentState of current.values()) {
    const nextState = next.get(currentState.id);

    if (!nextState || !isSameObjectSlot(currentState, nextState)) {
      if (currentState.kind === 'particle' && removedContainerIds.has(currentState.containerId)) {
        continue;
      }
      destroyStates.push(currentState);
    }
  }

  for (const nextState of next.values()) {
    const currentState = current.get(nextState.id);

    if (!currentState || !isSameObjectSlot(currentState, nextState)) {
      createStates.push(nextState);
      continue;
    }

    const propsDiff = diffProps(currentState.props, nextState.props);
    if (propsDiff.changed) {
      updateCommands.push(createUpdateCommand(nextState, propsDiff.props));

      if (
        currentState.kind === 'particleContainer' &&
        nextState.kind === 'particleContainer' &&
        !isDeepEqual(currentState.props.atlas, nextState.props.atlas)
      ) {
        collectParticleIds(next, nextState.id, forcedParticleUpdates);
      }
    }
  }

  destroyStates.sort(compareDestroyOrder);
  createStates.sort(compareCreateOrder);
  updateCommands.sort(compareUpdateOrder);

  for (const state of destroyStates) {
    commands.push(createDestroyCommand(state));
  }
  for (const state of createStates) {
    commands.push(createCreateCommand(state));
  }
  for (const command of updateCommands) {
    commands.push(command);
  }
  for (const particleId of forcedParticleUpdates) {
    if (!updateCommands.some((command) => command.kind === 'particle' && command.id === particleId)) {
      const particle = next.get(particleId);
      if (particle?.kind === 'particle') {
        commands.push(createUpdateCommand(particle, {}));
      }
    }
  }

  return commands;
}

function collectRemovedContainerIds(
  current: PixiReadonlyFrameStateMap,
  next: PixiReadonlyFrameStateMap,
) {
  const removedContainerIds = new Set<PixiRendererObjectId>();

  for (const state of current.values()) {
    const nextState = next.get(state.id);
    if (state.kind === 'particleContainer' && (!nextState || !isSameObjectSlot(state, nextState))) {
      removedContainerIds.add(state.id);
    }
  }

  return removedContainerIds;
}

function collectParticleIds(
  frame: PixiReadonlyFrameStateMap,
  containerId: PixiRendererObjectId,
  particleIds: Set<PixiRendererObjectId>,
) {
  for (const state of frame.values()) {
    if (state.kind === 'particle' && state.containerId === containerId) {
      particleIds.add(state.id);
    }
  }
}

function isSameObjectSlot(current: PixiFrameObjectState, next: PixiFrameObjectState) {
  if (current.kind !== next.kind) {
    return false;
  }

  return current.kind !== 'particle' || next.kind !== 'particle' || current.containerId === next.containerId;
}

function createCreateCommand(state: PixiFrameObjectState): PixiCreateCommand {
  if (state.kind === 'particle') {
    return {
      type: 'create',
      kind: 'particle',
      id: state.id,
      containerId: state.containerId,
      props: clonePlainValue(state.props),
    };
  }

  return {
    type: 'create',
    kind: state.kind,
    id: state.id,
    props: clonePlainValue(state.props),
  } as PixiCreateCommand;
}

function createUpdateCommand(state: PixiFrameObjectState, props: PlainObject): PixiUpdateCommand {
  if (state.kind === 'particle') {
    return {
      type: 'update',
      kind: 'particle',
      id: state.id,
      containerId: state.containerId,
      props: clonePlainValue(props),
    };
  }

  return {
    type: 'update',
    kind: state.kind,
    id: state.id,
    props: clonePlainValue(props),
  } as PixiUpdateCommand;
}

function createDestroyCommand(state: PixiFrameObjectState): PixiDestroyCommand {
  if (state.kind === 'particle') {
    return {
      type: 'destroy',
      kind: 'particle',
      id: state.id,
      containerId: state.containerId,
    };
  }
  if (state.kind === 'particleContainer') {
    return {
      type: 'destroy',
      kind: 'particleContainer',
      id: state.id,
      destroyParticles: true,
    };
  }

  return {
    type: 'destroy',
    kind: state.kind,
    id: state.id,
  } as PixiDestroyCommand;
}

function diffProps(currentProps: object, nextProps: object) {
  const props: PlainObject = {};
  let changed = false;

  for (const key of collectObjectKeys(currentProps, nextProps)) {
    const currentValue = (currentProps as PlainObject)[key];
    const nextValue = (nextProps as PlainObject)[key];
    if (!isDeepEqual(currentValue, nextValue)) {
      props[key] = clonePlainValue(nextValue);
      changed = true;
    }
  }

  return {
    changed,
    props,
  };
}

function collectObjectKeys(left: object, right: object) {
  return new Set([...Object.keys(left), ...Object.keys(right)]);
}

function compareDestroyOrder(left: PixiFrameObjectState, right: PixiFrameObjectState) {
  return getDestroyOrder(left) - getDestroyOrder(right);
}

function compareCreateOrder(left: PixiFrameObjectState, right: PixiFrameObjectState) {
  return getCreateOrder(left) - getCreateOrder(right);
}

function compareUpdateOrder(left: PixiUpdateCommand, right: PixiUpdateCommand) {
  return getUpdateOrder(left) - getUpdateOrder(right);
}

function getDestroyOrder(state: PixiFrameObjectState) {
  if (state.kind === 'particle') {
    return 0;
  }
  if (state.kind === 'particleContainer') {
    return 2;
  }
  return 1;
}

function getCreateOrder(state: PixiFrameObjectState) {
  if (state.kind === 'particleContainer') {
    return 0;
  }
  if (state.kind === 'particle') {
    return 2;
  }
  return 1;
}

function getUpdateOrder(command: PixiUpdateCommand) {
  if (command.kind === 'particleContainer') {
    return 0;
  }
  if (command.kind === 'particle') {
    return 2;
  }
  return 1;
}

function cloneFrameObjectState(state: PixiFrameObjectState): PixiFrameObjectState {
  if (state.kind === 'particle') {
    return {
      id: state.id,
      kind: 'particle',
      containerId: state.containerId,
      props: clonePlainValue(state.props),
    };
  }

  return {
    id: state.id,
    kind: state.kind,
    props: clonePlainValue(state.props),
  } as PixiFrameObjectState;
}

function clonePlainValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clonePlainValue(item)) as T;
  }
  if (isPlainObject(value)) {
    const cloned: PlainObject = {};
    for (const [key, childValue] of Object.entries(value)) {
      cloned[key] = clonePlainValue(childValue);
    }
    return cloned as T;
  }

  return value;
}

function isDeepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => isDeepEqual(value, right[index]));
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    if (!isPlainObject(left) || !isPlainObject(right)) {
      return false;
    }

    const keys = collectObjectKeys(left, right);
    for (const key of keys) {
      if (!isDeepEqual(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
