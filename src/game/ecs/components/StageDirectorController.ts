import type {
  StageDirectorActionName,
  StageDirectorActionRequestMap,
  StageDirectorControllerComponent,
} from '../../types';

export type {
  StageDirectorActionName,
  StageDirectorActionRequestMap,
  StageDirectorControllerComponent,
} from '../../types';

export const DEFAULT_STAGE_DIRECTOR_ACTIONS: StageDirectorActionName[] = [
  'playScript',
  'stopScript',
  'stopAll',
  'pauseScript',
  'resumeScript',
];

export const createStageDirectorController = (
  options: Partial<Omit<StageDirectorControllerComponent, 'type'>> = {},
): StageDirectorControllerComponent => {
  const allowedActions = options.allowedActions ?? [...DEFAULT_STAGE_DIRECTOR_ACTIONS];
  return {
    type: 'StageDirectorController',
    id: options.id ?? 'director.default',
    scope: options.scope ?? 'default',
    enabled: options.enabled ?? true,
    conflictPolicy: options.conflictPolicy ?? 'localFirst',
    maxActiveInstances: Math.max(1, options.maxActiveInstances ?? 16),
    defaultPriority: options.defaultPriority ?? 0,
    allowCrossScope: options.allowCrossScope ?? false,
    allowedActions,
    actionRequests:
      options.actionRequests ?? createStageDirectorActionRequestState(allowedActions),
  };
};

export function createStageDirectorActionRequestState(
  allowedActions: readonly StageDirectorActionName[],
): StageDirectorActionRequestMap {
  const state: StageDirectorActionRequestMap = {};
  for (const action of allowedActions) {
    state[action] = {
      pending: false,
      args: {},
    };
  }
  return state;
}

export function queueStageDirectorControllerAction(
  controller: StageDirectorControllerComponent,
  action: string,
  args: Record<string, unknown> = {},
): boolean {
  if (!isStageDirectorActionName(action)) return false;
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

export function consumeStageDirectorControllerActions(
  controller: StageDirectorControllerComponent,
): Array<{ action: StageDirectorActionName; args: Record<string, unknown> }> {
  const consumed: Array<{ action: StageDirectorActionName; args: Record<string, unknown> }> = [];
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

export function isStageDirectorActionName(value: string): value is StageDirectorActionName {
  return (
    value === 'playScript' ||
    value === 'stopScript' ||
    value === 'stopAll' ||
    value === 'pauseScript' ||
    value === 'resumeScript'
  );
}
