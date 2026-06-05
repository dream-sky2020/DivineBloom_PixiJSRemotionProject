import type {
  EngineConfig,
  InputActionDefinition,
  InputActionMapDefinition,
  InputBindingDefinition,
  InputBindingPartDefinition,
  InputConfig,
  InputRouteDefinition,
  InputRoutePhase,
  InputRouteSetDefinition,
  InputToSignalMapConfig,
  SystemConfig,
} from '../../types';
import { sendDebugCommand } from '../../../debug/DebugLogger';
import { parseLoosePrimitive } from '../utils/primitive';
import { getDirectChildByTag, getDirectChildren } from '../xml/XmlDom';

const DEBUG_PARSE_ENGINE_CONFIG = true;

export function parseEngineConfig(worldEl: Element): EngineConfig {
  debug('start');
  const configEl = getDirectChildByTag(worldEl, 'EngineConfig');
  const systems: SystemConfig[] = [];
  let inputConfig: InputConfig | undefined;
  let inputToSignalMap: InputToSignalMapConfig | undefined;

  if (configEl) {
    const pipelineEl = getDirectChildByTag(configEl, 'SystemPipeline');
    if (pipelineEl) {
      for (const el of getDirectChildren(pipelineEl)) {
        if (el.tagName !== 'System') continue;
        systems.push({
          name: el.getAttribute('name') || '',
          enabled: el.getAttribute('enabled') !== 'false',
        });
      }
      debug('systemPipeline:parsed', { count: systems.length });
    }

    inputConfig = parseInputConfig(configEl);
    inputToSignalMap = parseInputToSignalMap(configEl);

    // 暂时忽略 SignalDefinitions，仅作为文档/元数据存在
  }

  debug('done', {
    systems: systems.length,
    hasInputConfig: Boolean(inputConfig),
    hasInputToSignalMap: Boolean(inputToSignalMap),
  });
  return { systems, inputConfig, inputToSignalMap };
}

function parseInputConfig(configEl: Element): InputConfig | undefined {
  const inputEl = getDirectChildByTag(configEl, 'InputConfig');
  if (!inputEl) return undefined;

  const modeAttr = (inputEl.getAttribute('mode') || 'strict').trim().toLowerCase();
  const mode: 'strict' | 'loose' = modeAttr === 'loose' ? 'loose' : 'strict';
  const devicePolicy = (inputEl.getAttribute('devicePolicy') || 'keyboard,mouse')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const deadzone = parseFloat(inputEl.getAttribute('deadzone') || '0.15');

  const actionMaps: InputActionMapDefinition[] = [];
  const actionMapsEl = getDirectChildByTag(inputEl, 'ActionMaps');
  const activeMap = actionMapsEl?.getAttribute('active')?.trim() || undefined;
  if (actionMapsEl) {
    for (const mapEl of getDirectChildren(actionMapsEl)) {
      if (mapEl.tagName !== 'ActionMap') continue;
      const mapId = (mapEl.getAttribute('id') || '').trim();
      if (!mapId) continue;
      const actions: InputActionDefinition[] = [];
      for (const actionEl of getDirectChildren(mapEl)) {
        if (actionEl.tagName !== 'Action') continue;
        const actionId = (actionEl.getAttribute('id') || '').trim();
        if (!actionId) continue;
        const actionTypeRaw = (actionEl.getAttribute('type') || 'button').trim();
        const actionType =
          actionTypeRaw === 'axis1' || actionTypeRaw === 'axis2' ? actionTypeRaw : 'button';
        actions.push({
          id: actionId,
          type: actionType,
        });
      }
      actionMaps.push({
        id: mapId,
        enabled: mapEl.getAttribute('enabled') !== 'false',
        actions,
      });
    }
  }

  const bindings: InputBindingDefinition[] = [];
  const bindingsEl = getDirectChildByTag(inputEl, 'Bindings');
  if (bindingsEl) {
    for (const bindingEl of getDirectChildren(bindingsEl)) {
      if (bindingEl.tagName !== 'Binding') continue;
      const action = (bindingEl.getAttribute('action') || '').trim();
      if (!action) continue;
      const parts: InputBindingPartDefinition[] = [];
      for (const partEl of getDirectChildren(bindingEl)) {
        if (partEl.tagName !== 'Part') continue;
        const partName = (partEl.getAttribute('name') || '').trim();
        const partPath = (partEl.getAttribute('path') || '').trim();
        if (!partName || !partPath) continue;
        parts.push({ name: partName, path: partPath });
      }

      const kindAttr = (bindingEl.getAttribute('kind') || '').trim();
      const kind = kindAttr === '2dComposite' ? '2dComposite' : undefined;

      bindings.push({
        action,
        map: bindingEl.getAttribute('map')?.trim() || undefined,
        path: bindingEl.getAttribute('path')?.trim() || undefined,
        kind,
        processor: bindingEl.getAttribute('processor')?.trim() || undefined,
        parts,
      });
    }
  }

  return {
    mode,
    devicePolicy,
    deadzone: Number.isFinite(deadzone) ? deadzone : 0.15,
    activeMap,
    actionMaps,
    bindings,
  };
}

function parseInputToSignalMap(configEl: Element): InputToSignalMapConfig | undefined {
  const mapEl = getDirectChildByTag(configEl, 'InputToSignalMap');
  if (!mapEl) return undefined;

  const routes: InputRouteDefinition[] = [];
  for (const routeEl of getDirectChildren(mapEl)) {
    if (routeEl.tagName !== 'Route') continue;
    const action = (routeEl.getAttribute('action') || '').trim();
    const emit = (routeEl.getAttribute('emit') || '').trim();
    const phaseRaw = (routeEl.getAttribute('phase') || 'pressed').trim().toLowerCase();
    const phase: InputRoutePhase = isInputRoutePhase(phaseRaw) ? phaseRaw : 'pressed';
    if (!action || !emit) continue;

    const sets: InputRouteSetDefinition[] = [];
    const payloadEl = getDirectChildByTag(routeEl, 'Payload');
    if (payloadEl) {
      for (const setEl of getDirectChildren(payloadEl)) {
        if (setEl.tagName !== 'Set') continue;
        const key = (setEl.getAttribute('key') || '').trim();
        if (!key) continue;
        const from = setEl.getAttribute('from')?.trim() || undefined;
        const valueAttr = setEl.getAttribute('value');
        sets.push({
          key,
          from,
          value: valueAttr === null ? undefined : parseLoosePrimitive(valueAttr),
        });
      }
    }

    routes.push({
      action,
      map: routeEl.getAttribute('map')?.trim() || undefined,
      phase,
      emit,
      throttleMs: parseInt(routeEl.getAttribute('throttleMs') || '0', 10) || 0,
      sets,
    });
  }

  return {
    defaultMap: mapEl.getAttribute('defaultMap')?.trim() || undefined,
    routes,
  };
}

function isInputRoutePhase(value: string): value is InputRoutePhase {
  return value === 'pressed' || value === 'released' || value === 'held' || value === 'changed';
}

function debug(message: string, payload?: Record<string, unknown>): void {
  if (!DEBUG_PARSE_ENGINE_CONFIG) return;
  sendDebugCommand({
    level: 'DEBUG',
    source: 'XmlParser:parseEngineConfig',
    message,
    detail: payload,
  });
}
