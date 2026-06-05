import type { Component } from '../../types';

export type GameObjectControllerActionName = 'destroy';

export interface GameObjectControllerActionRequest {
  pending: boolean;
  args: Record<string, unknown>;
}

export type GameObjectControllerActionRequestMap = Partial<
  Record<GameObjectControllerActionName, GameObjectControllerActionRequest>
>;

export interface GameObjectControllerComponent extends Component {
  readonly type: 'GameObjectController';
  alive: boolean;
  destroyable: boolean;
  destroyDelayMs: number;
  allowedActions: GameObjectControllerActionName[];
  actionRequests: GameObjectControllerActionRequestMap;
  pendingDestroy: boolean;
  destroyAt: number | null;
  destroyReason?: string;
}

export const DEFAULT_GAMEOBJECT_CONTROLLER_ACTIONS: GameObjectControllerActionName[] = ['destroy'];

export const createGameObjectController = (
  options: Partial<Omit<GameObjectControllerComponent, 'type'>> = {},
): GameObjectControllerComponent => {
  const allowedActions = options.allowedActions ?? [...DEFAULT_GAMEOBJECT_CONTROLLER_ACTIONS];
  return {
    type: 'GameObjectController',
    alive: options.alive ?? true,
    destroyable: options.destroyable ?? true,
    destroyDelayMs: options.destroyDelayMs ?? 0,
    allowedActions,
    actionRequests: options.actionRequests ?? createGameObjectControllerActionRequestState(allowedActions),
    pendingDestroy: options.pendingDestroy ?? false,
    destroyAt: options.destroyAt ?? null,
    destroyReason: options.destroyReason,
  };
};

export function createGameObjectControllerActionRequestState(
  allowedActions: readonly GameObjectControllerActionName[],
): GameObjectControllerActionRequestMap {
  const state: GameObjectControllerActionRequestMap = {};
  for (const action of allowedActions) {
    state[action] = {
      pending: false,
      args: {},
    };
  }
  return state;
}

export function isGameObjectControllerActionName(value: string): value is GameObjectControllerActionName {
  return (DEFAULT_GAMEOBJECT_CONTROLLER_ACTIONS as string[]).includes(value);
}

export function queueGameObjectControllerAction(
  controller: GameObjectControllerComponent,
  action: string,
  args: Record<string, unknown> = {},
): boolean {
  if (!isGameObjectControllerActionName(action)) return false;
  if (!controller.allowedActions.includes(action)) return false;

  if (!controller.actionRequests[action]) {
    controller.actionRequests[action] = {
      pending: false,
      args: {},
    };
  }
  const request = controller.actionRequests[action];
  if (!request) return false;
  request.pending = true;
  request.args = { ...args };
  return true;
}

export function consumeGameObjectControllerActions(
  controller: GameObjectControllerComponent,
): Array<{ action: GameObjectControllerActionName; args: Record<string, unknown> }> {
  const consumed: Array<{ action: GameObjectControllerActionName; args: Record<string, unknown> }> = [];
  for (const action of controller.allowedActions) {
    const request = controller.actionRequests[action];
    if (!request?.pending) continue;
    consumed.push({
      action,
      args: request.args,
    });
    request.pending = false;
    request.args = {};
  }
  return consumed;
}
