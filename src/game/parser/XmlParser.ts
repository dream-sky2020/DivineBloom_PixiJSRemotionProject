import type { 
  Entity, 
  AnyComponent, 
  TransformComponent, 
  SpriteComponent, 
  RigidBodyComponent, 
  BoxColliderComponent,
  CircleColliderComponent,
  PolygonColliderComponent,
  GraphicComponent,
  CameraComponent,
  ParticleEmitterComponent,
  AnimationsComponent,
  AnimationControllerComponent,
  AnimationActionName,
  AnimationLayerConfig,
  AnimationLayerState,
  AnimationControllerMode,
  AnimationLayerConflictPolicy,
  AnimationDirection,
  StageScriptAsset,
  StageScriptCue,
  StageScriptEvent,
  StageScriptKey,
  StageScriptLibraryAsset,
  StageScriptRole,
  StageScriptTrack,
  StageDirectorControllerComponent,
  StageDirectorActionName,
  GameObjectControllerComponent,
  GameObjectControllerActionName,
  InputActionDefinition,
  InputActionMapDefinition,
  InputBindingDefinition,
  InputBindingPartDefinition,
  InputConfig,
  InputRouteDefinition,
  InputRouteSetDefinition,
  InputToSignalMapConfig,
  InputRoutePhase,
  SignalConfigComponent,
  CanvasComponent,
  WorldData,
  EngineConfig,
  SystemConfig
} from '../types';
import { createGameObjectControllerActionRequestState } from '../ecs/components/GameObjectController';
import { createStageDirectorActionRequestState } from '../ecs/components/StageDirectorController';

interface PrefabDefinition {
  id: string;
  extendsId?: string;
  gameObjectEl: Element;
}

interface ResolvedPrefabTemplate {
  id: string;
  name?: string;
  components: Map<string, Element>;
}

export class XmlParser {
  static async parseWorld(xmlString: string): Promise<WorldData> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const worldElement = xmlDoc.getElementsByTagName('World')[0];
    
    if (!worldElement) {
      throw new Error('Invalid XML: Missing <World> root element');
    }

    // Parse EngineConfig
    const config = this.parseEngineConfig(worldElement);

    // Parse Canvas
    const canvas = this.parseCanvas(worldElement);
    const stageScriptLibrary = this.parseStageScriptLibrary(worldElement);

    // Parse Prefab library
    const prefabRegistry = await this.parsePrefabLibrary(worldElement);
    const resolvedPrefabCache = new Map<string, ResolvedPrefabTemplate>();

    // Parse scene entities from direct World children
    const entities: Entity[] = [];
    const existingEntityIds = new Set<string>();
    let fallbackIdCounter = 0;

    for (const child of this.getDirectChildren(worldElement)) {
      if (child.tagName === 'GameObject') {
        const entity = this.parseGameObjectElement(child, `entity_${fallbackIdCounter++}`);
        this.appendEntity(entities, existingEntityIds, entity);
        continue;
      }

      if (child.tagName === 'Instance') {
        const entity = this.parseInstanceElement(
          child,
          prefabRegistry,
          resolvedPrefabCache,
          `entity_${fallbackIdCounter++}`,
        );
        this.appendEntity(entities, existingEntityIds, entity);
      }
    }

    return { config, canvas, stageScriptLibrary, entities };
  }

  private static parseCanvas(worldEl: Element): CanvasComponent | undefined {
    const canvasEl = this.getDirectChildByTag(worldEl, 'Canvas');
    if (!canvasEl) return undefined;

    return {
      type: 'Canvas',
      name: canvasEl.getAttribute('name') || 'Untitled',
      width: parseFloat(canvasEl.getAttribute('width') || '1920'),
      height: parseFloat(canvasEl.getAttribute('height') || '1080'),
      background: canvasEl.getAttribute('background') || undefined,
    };
  }

  private static parseStageScriptLibrary(worldEl: Element): StageScriptLibraryAsset | undefined {
    const libraryEl = this.getDirectChildByTag(worldEl, 'StageScriptLibrary');
    if (!libraryEl) return undefined;

    const scripts: Record<string, StageScriptAsset> = {};
    const defaultFps = Math.max(1, parseFloat(libraryEl.getAttribute('defaultFps') || '60') || 60);
    for (const scriptEl of this.getDirectChildren(libraryEl)) {
      if (scriptEl.tagName !== 'StageScript') continue;
      const parsed = this.parseStageScript(scriptEl, defaultFps);
      if (!parsed) continue;
      scripts[parsed.id] = parsed;
    }

    return {
      mode: (libraryEl.getAttribute('mode') || 'strict') === 'loose' ? 'loose' : 'strict',
      defaultFps,
      unknownScript: parseUnknownScriptPolicy(libraryEl.getAttribute('unknownScript')),
      scripts,
    };
  }

  private static parseStageScript(scriptEl: Element, defaultFps: number): StageScriptAsset | undefined {
    const id = (scriptEl.getAttribute('id') || '').trim();
    if (!id) return undefined;
    const duration = Math.max(0, parseFloat(scriptEl.getAttribute('duration') || '0') || 0);
    if (duration <= 0) return undefined;

    const rolesEl = this.getDirectChildByTag(scriptEl, 'Roles');
    const tracksEl = this.getDirectChildByTag(scriptEl, 'Tracks');
    const cuesEl = this.getDirectChildByTag(scriptEl, 'Cues');

    const roles: StageScriptRole[] = [];
    if (rolesEl) {
      for (const roleEl of this.getDirectChildren(rolesEl)) {
        if (roleEl.tagName !== 'Role') continue;
        const roleId = (roleEl.getAttribute('id') || '').trim();
        if (!roleId) continue;
        roles.push({
          id: roleId,
          required: roleEl.getAttribute('required') !== 'false',
        });
      }
    }

    const tracks: StageScriptTrack[] = [];
    if (tracksEl) {
      for (const trackEl of this.getDirectChildren(tracksEl)) {
        if (trackEl.tagName !== 'Track') continue;
        const role = (trackEl.getAttribute('role') || '').trim();
        const prop = (trackEl.getAttribute('prop') || '').trim();
        if (!role || !prop) continue;
        const keys: StageScriptKey[] = [];
        for (const keyEl of this.getDirectChildren(trackEl)) {
          if (keyEl.tagName !== 'Key') continue;
          const valueRaw = keyEl.getAttribute('value');
          if (valueRaw === null) continue;
          const key: StageScriptKey = {
            frame: Math.max(0, parseFloat(keyEl.getAttribute('frame') || '0') || 0),
            value: parseAnimationValue(valueRaw),
            easing: keyEl.getAttribute('easing')?.trim() || undefined,
            events: this.parseStageScriptEvents(keyEl),
          };
          keys.push(key);
        }
        keys.sort((left, right) => left.frame - right.frame);
        tracks.push({
          role,
          prop,
          interpolation: parseStageInterpolation(trackEl.getAttribute('interpolation')),
          valueMode: parseStageValueMode(trackEl.getAttribute('valueMode')),
          keys,
        });
      }
    }

    const cues: StageScriptCue[] = [];
    if (cuesEl) {
      for (const cueEl of this.getDirectChildren(cuesEl)) {
        if (cueEl.tagName !== 'Cue') continue;
        const signal = (cueEl.getAttribute('signal') || '').trim();
        if (!signal) continue;
        cues.push({
          frame: Math.max(0, parseFloat(cueEl.getAttribute('frame') || '0') || 0),
          signal,
          payloadSets: this.parsePayloadSets(this.getDirectChildByTag(cueEl, 'Payload')),
        });
      }
    }

    return {
      id,
      duration,
      fps: Math.max(1, parseFloat(scriptEl.getAttribute('fps') || `${defaultFps}`) || defaultFps),
      interruptPolicy: parseInterruptPolicy(scriptEl.getAttribute('interruptPolicy')),
      completeSignal: scriptEl.getAttribute('completeSignal')?.trim() || undefined,
      roles,
      tracks,
      cues,
    };
  }

  private static parseStageScriptEvents(keyEl: Element): StageScriptEvent[] {
    const eventsEl = this.getDirectChildByTag(keyEl, 'Events');
    if (!eventsEl) return [];

    const events: StageScriptEvent[] = [];
    for (const eventEl of this.getDirectChildren(eventsEl)) {
      if (eventEl.tagName !== 'Event') continue;
      const signal = (eventEl.getAttribute('signal') || '').trim();
      if (!signal) continue;
      events.push({
        signal,
        once: eventEl.getAttribute('once') !== 'false',
        phase: parseAnimationKeyEventPhase(eventEl.getAttribute('phase')),
        direction: parseAnimationKeyEventDirection(eventEl.getAttribute('direction')),
        fireOnSeek: eventEl.getAttribute('fireOnSeek') === 'true',
        cooldownMs: Math.max(0, parseFloat(eventEl.getAttribute('cooldownMs') || '0') || 0),
        payloadSets: this.parsePayloadSets(this.getDirectChildByTag(eventEl, 'Payload')),
      });
    }
    return events;
  }

  private static parsePayloadSets(payloadEl: Element | undefined): Array<{
    key: string;
    from?: string;
    value?: number | string | boolean;
  }> {
    if (!payloadEl) return [];
    const sets: Array<{ key: string; from?: string; value?: number | string | boolean }> = [];
    for (const setEl of this.getDirectChildren(payloadEl)) {
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
    return sets;
  }

  private static parseEngineConfig(worldEl: Element): EngineConfig {
    const configEl = this.getDirectChildByTag(worldEl, 'EngineConfig');
    const systems: SystemConfig[] = [];
    let inputConfig: InputConfig | undefined;
    let inputToSignalMap: InputToSignalMapConfig | undefined;

    if (configEl) {
      const pipelineEl = this.getDirectChildByTag(configEl, 'SystemPipeline');
      if (pipelineEl) {
        for (const el of this.getDirectChildren(pipelineEl)) {
          if (el.tagName !== 'System') continue;
          systems.push({
            name: el.getAttribute('name') || '',
            enabled: el.getAttribute('enabled') !== 'false'
          });
        }
      }

      inputConfig = this.parseInputConfig(configEl);
      inputToSignalMap = this.parseInputToSignalMap(configEl);
    }

    return { systems, inputConfig, inputToSignalMap };
  }

  private static parseInputConfig(configEl: Element): InputConfig | undefined {
    const inputEl = this.getDirectChildByTag(configEl, 'InputConfig');
    if (!inputEl) return undefined;

    const modeAttr = (inputEl.getAttribute('mode') || 'strict').trim().toLowerCase();
    const mode: 'strict' | 'loose' = modeAttr === 'loose' ? 'loose' : 'strict';
    const devicePolicy = (inputEl.getAttribute('devicePolicy') || 'keyboard,mouse')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const deadzone = parseFloat(inputEl.getAttribute('deadzone') || '0.15');

    const actionMaps: InputActionMapDefinition[] = [];
    const actionMapsEl = this.getDirectChildByTag(inputEl, 'ActionMaps');
    const activeMap = actionMapsEl?.getAttribute('active')?.trim() || undefined;
    if (actionMapsEl) {
      for (const mapEl of this.getDirectChildren(actionMapsEl)) {
        if (mapEl.tagName !== 'ActionMap') continue;
        const mapId = (mapEl.getAttribute('id') || '').trim();
        if (!mapId) continue;
        const actions: InputActionDefinition[] = [];
        for (const actionEl of this.getDirectChildren(mapEl)) {
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
    const bindingsEl = this.getDirectChildByTag(inputEl, 'Bindings');
    if (bindingsEl) {
      for (const bindingEl of this.getDirectChildren(bindingsEl)) {
        if (bindingEl.tagName !== 'Binding') continue;
        const action = (bindingEl.getAttribute('action') || '').trim();
        if (!action) continue;
        const parts: InputBindingPartDefinition[] = [];
        for (const partEl of this.getDirectChildren(bindingEl)) {
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

  private static parseInputToSignalMap(configEl: Element): InputToSignalMapConfig | undefined {
    const mapEl = this.getDirectChildByTag(configEl, 'InputToSignalMap');
    if (!mapEl) return undefined;

    const routes: InputRouteDefinition[] = [];
    for (const routeEl of this.getDirectChildren(mapEl)) {
      if (routeEl.tagName !== 'Route') continue;
      const action = (routeEl.getAttribute('action') || '').trim();
      const emit = (routeEl.getAttribute('emit') || '').trim();
      const phaseRaw = (routeEl.getAttribute('phase') || 'pressed').trim().toLowerCase();
      const phase: InputRoutePhase = isInputRoutePhase(phaseRaw) ? phaseRaw : 'pressed';
      if (!action || !emit) continue;

      const sets: InputRouteSetDefinition[] = [];
      const payloadEl = this.getDirectChildByTag(routeEl, 'Payload');
      if (payloadEl) {
        for (const setEl of this.getDirectChildren(payloadEl)) {
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

  private static async parsePrefabLibrary(worldEl: Element): Promise<Map<string, PrefabDefinition>> {
    const libraryEl = this.getDirectChildByTag(worldEl, 'PrefabLibrary');
    const prefabs = new Map<string, PrefabDefinition>();

    if (!libraryEl) return prefabs;

    for (const prefabEl of this.getDirectChildren(libraryEl)) {
      if (prefabEl.tagName !== 'Prefab') continue;

      const declaredId = prefabEl.getAttribute('id')?.trim();
      const src = prefabEl.getAttribute('src')?.trim();

      let extendsId = prefabEl.getAttribute('extends')?.trim() || undefined;
      let gameObjectEl = this.getDirectChildByTag(prefabEl, 'GameObject');
      let resolvedId = declaredId;

      if (src) {
        const loaded = await this.loadPrefabDefinitionFromPublic(src);
        resolvedId = resolvedId || loaded.id;
        extendsId = extendsId || loaded.extendsId;
        gameObjectEl = loaded.gameObjectEl;
      }

      if (!resolvedId) {
        throw new Error('Invalid XML: <Prefab> is missing required attribute "id"');
      }
      if (!gameObjectEl) {
        throw new Error(`Invalid XML: Prefab "${resolvedId}" must contain one <GameObject> child`);
      }
      if (prefabs.has(resolvedId)) {
        throw new Error(`Invalid XML: Duplicate prefab id "${resolvedId}"`);
      }

      prefabs.set(resolvedId, {
        id: resolvedId,
        extendsId,
        gameObjectEl,
      });
    }

    return prefabs;
  }

  private static async loadPrefabDefinitionFromPublic(src: string): Promise<PrefabDefinition> {
    const normalizedSrc = this.normalizePublicPrefabPath(src);

    let response: Response;
    try {
      response = await fetch(normalizedSrc);
    } catch (error) {
      throw new Error(`Invalid XML: Failed to load prefab file "${src}" from public`);
    }

    if (!response.ok) {
      throw new Error(`Invalid XML: Failed to load prefab file "${src}" from public`);
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      throw new Error(`Invalid XML: Prefab file "${src}" has invalid XML format`);
    }

    const prefabRoot = xmlDoc.documentElement;
    if (!prefabRoot) {
      throw new Error(`Invalid XML: Prefab file "${src}" is empty`);
    }

    if (prefabRoot.tagName === 'Prefab') {
      const id = prefabRoot.getAttribute('id')?.trim();
      const gameObjectEl = this.getDirectChildByTag(prefabRoot, 'GameObject');
      if (!gameObjectEl) {
        throw new Error(`Invalid XML: Prefab file "${src}" must contain one <GameObject>`);
      }
      return {
        id: id || '',
        extendsId: prefabRoot.getAttribute('extends')?.trim() || undefined,
        gameObjectEl,
      };
    }

    if (prefabRoot.tagName === 'GameObject') {
      return {
        id: '',
        extendsId: undefined,
        gameObjectEl: prefabRoot,
      };
    }

    if (prefabRoot.tagName === 'PrefabLibrary') {
      const prefabEls = this.getDirectChildren(prefabRoot).filter((child) => child.tagName === 'Prefab');
      if (prefabEls.length === 0) {
        throw new Error(`Invalid XML: Prefab file "${src}" has no <Prefab> definition`);
      }
      const selectedPrefab = this.selectExportedPrefab(prefabEls, src);
      const gameObjectEl = this.getDirectChildByTag(selectedPrefab, 'GameObject');
      if (!gameObjectEl) {
        throw new Error(`Invalid XML: Prefab file "${src}" has <Prefab> without <GameObject>`);
      }
      return {
        id: selectedPrefab.getAttribute('id')?.trim() || '',
        extendsId: selectedPrefab.getAttribute('extends')?.trim() || undefined,
        gameObjectEl,
      };
    }

    if (prefabRoot.tagName === 'World') {
      const externalLibrary = this.getDirectChildByTag(prefabRoot, 'PrefabLibrary');
      if (!externalLibrary) {
        throw new Error(`Invalid XML: World prefab file "${src}" must contain <PrefabLibrary>`);
      }

      const prefabEls = this.getDirectChildren(externalLibrary).filter((child) => child.tagName === 'Prefab');
      if (prefabEls.length === 0) {
        throw new Error(`Invalid XML: World prefab file "${src}" has no <Prefab> definition`);
      }

      const selectedPrefab = this.selectExportedPrefab(prefabEls, src);
      const gameObjectEl = this.getDirectChildByTag(selectedPrefab, 'GameObject');
      if (!gameObjectEl) {
        throw new Error(`Invalid XML: World prefab file "${src}" has exported <Prefab> without <GameObject>`);
      }

      return {
        id: selectedPrefab.getAttribute('id')?.trim() || '',
        extendsId: selectedPrefab.getAttribute('extends')?.trim() || undefined,
        gameObjectEl,
      };
    }

    throw new Error(`Invalid XML: Prefab file "${src}" must use <Prefab>, <PrefabLibrary>, <World> or <GameObject> root`);
  }

  private static selectExportedPrefab(prefabEls: Element[], src: string): Element {
    const exportedPrefabs = prefabEls.filter((prefabEl) => prefabEl.getAttribute('export') === 'true');

    if (exportedPrefabs.length > 1) {
      throw new Error(`Invalid XML: Prefab file "${src}" has multiple <Prefab export="true"> definitions`);
    }

    if (exportedPrefabs.length === 1) {
      return exportedPrefabs[0];
    }

    if (prefabEls.length === 1) {
      return prefabEls[0];
    }

    throw new Error(
      `Invalid XML: Prefab file "${src}" has multiple <Prefab> definitions but none marked with export="true"`,
    );
  }

  private static normalizePublicPrefabPath(src: string): string {
    const trimmed = src.trim();
    if (!trimmed) {
      throw new Error('Invalid XML: <Prefab src> cannot be empty');
    }
    if (trimmed.includes('..')) {
      throw new Error(`Invalid XML: Prefab src "${src}" cannot contain ".."`);
    }

    let normalized = trimmed.replace(/\\/g, '/');
    if (normalized.startsWith('./')) {
      normalized = normalized.slice(2);
    }
    if (normalized.startsWith('public/')) {
      normalized = normalized.slice('public/'.length);
    }
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    return normalized;
  }

  private static parseGameObjectElement(el: Element, fallbackId: string): Entity {
    const id = el.getAttribute('id') || fallbackId;
    const name = el.getAttribute('name') || undefined;
    const components = this.parseComponentsFromElement(el);

    return {
      id,
      name,
      components,
    };
  }

  private static parseInstanceElement(
    instanceEl: Element,
    prefabRegistry: Map<string, PrefabDefinition>,
    resolvedPrefabCache: Map<string, ResolvedPrefabTemplate>,
    fallbackId: string,
  ): Entity {
    const prefabId = instanceEl.getAttribute('prefab')?.trim();
    if (!prefabId) {
      throw new Error('Invalid XML: <Instance> is missing required attribute "prefab"');
    }

    const resolvedPrefab = this.resolvePrefabTemplate(
      prefabId,
      prefabRegistry,
      resolvedPrefabCache,
      new Set<string>(),
    );

    const id = instanceEl.getAttribute('id') || fallbackId;
    const name = instanceEl.getAttribute('name') || resolvedPrefab.name || undefined;

    const mergedComponentEls = this.cloneComponentElementMap(resolvedPrefab.components);
    for (const overrideEl of this.getDirectChildren(instanceEl)) {
      const type = overrideEl.tagName;
      const baseEl = mergedComponentEls.get(type);
      mergedComponentEls.set(type, this.mergeComponentElements(baseEl, overrideEl));
    }

    const components = this.parseComponentsFromMap(mergedComponentEls);
    return { id, name, components };
  }

  private static resolvePrefabTemplate(
    prefabId: string,
    prefabRegistry: Map<string, PrefabDefinition>,
    resolvedPrefabCache: Map<string, ResolvedPrefabTemplate>,
    resolvingStack: Set<string>,
  ): ResolvedPrefabTemplate {
    const cached = resolvedPrefabCache.get(prefabId);
    if (cached) {
      return this.cloneResolvedTemplate(cached);
    }

    const prefab = prefabRegistry.get(prefabId);
    if (!prefab) {
      throw new Error(`Invalid XML: Prefab "${prefabId}" does not exist`);
    }

    if (resolvingStack.has(prefabId)) {
      throw new Error(`Invalid XML: Circular prefab inheritance detected at "${prefabId}"`);
    }

    resolvingStack.add(prefabId);

    let mergedComponents = new Map<string, Element>();
    let templateName: string | undefined;

    if (prefab.extendsId) {
      const baseTemplate = this.resolvePrefabTemplate(
        prefab.extendsId,
        prefabRegistry,
        resolvedPrefabCache,
        resolvingStack,
      );
      mergedComponents = this.cloneComponentElementMap(baseTemplate.components);
      templateName = baseTemplate.name;
    }

    const ownName = prefab.gameObjectEl.getAttribute('name') || undefined;
    templateName = ownName || templateName;

    const ownComponents = this.collectComponentElements(prefab.gameObjectEl);
    for (const [type, ownEl] of ownComponents.entries()) {
      const baseEl = mergedComponents.get(type);
      mergedComponents.set(type, this.mergeComponentElements(baseEl, ownEl));
    }

    resolvingStack.delete(prefabId);

    const resolved: ResolvedPrefabTemplate = {
      id: prefabId,
      name: templateName,
      components: mergedComponents,
    };

    resolvedPrefabCache.set(prefabId, this.cloneResolvedTemplate(resolved));
    return this.cloneResolvedTemplate(resolved);
  }

  private static collectComponentElements(parent: Element): Map<string, Element> {
    const map = new Map<string, Element>();

    for (const child of this.getDirectChildren(parent)) {
      map.set(child.tagName, child);
    }

    return map;
  }

  private static parseComponentsFromElement(parent: Element): Map<string, AnyComponent> {
    return this.parseComponentsFromMap(this.collectComponentElements(parent));
  }

  private static parseComponentsFromMap(componentEls: Map<string, Element>): Map<string, AnyComponent> {
    const components = new Map<string, AnyComponent>();

    for (const componentEl of componentEls.values()) {
      const component = this.parseComponent(componentEl);
      if (component) {
        components.set(component.type, component);
      }
    }

    return components;
  }

  private static appendEntity(entities: Entity[], existingEntityIds: Set<string>, entity: Entity): void {
    const normalizedId = String(entity.id);
    if (existingEntityIds.has(normalizedId)) {
      throw new Error(`Invalid XML: Duplicate entity id "${normalizedId}"`);
    }
    existingEntityIds.add(normalizedId);
    entities.push(entity);
  }

  private static mergeComponentElements(baseEl: Element | undefined, overrideEl: Element): Element {
    if (!baseEl) {
      return overrideEl.cloneNode(true) as Element;
    }

    const merged = baseEl.cloneNode(true) as Element;
    for (let i = 0; i < overrideEl.attributes.length; i++) {
      const attr = overrideEl.attributes.item(i);
      if (!attr) continue;
      merged.setAttribute(attr.name, attr.value);
    }
    return merged;
  }

  private static cloneComponentElementMap(source: Map<string, Element>): Map<string, Element> {
    const cloned = new Map<string, Element>();
    for (const [type, element] of source.entries()) {
      cloned.set(type, element.cloneNode(true) as Element);
    }
    return cloned;
  }

  private static cloneResolvedTemplate(source: ResolvedPrefabTemplate): ResolvedPrefabTemplate {
    return {
      id: source.id,
      name: source.name,
      components: this.cloneComponentElementMap(source.components),
    };
  }

  private static getDirectChildren(parent: Element): Element[] {
    return Array.from(parent.children) as Element[];
  }

  private static getDirectChildByTag(parent: Element, tagName: string): Element | undefined {
    return this.getDirectChildren(parent).find((child) => child.tagName === tagName);
  }

  private static parseComponent(el: Element): AnyComponent | null {
    const type = el.tagName;

    switch (type) {
      case 'Transform':
        return this.parseTransform(el);
      case 'Sprite':
        return this.parseSprite(el);
      case 'RigidBody':
        return this.parseRigidBody(el);
      case 'BoxCollider':
        return this.parseBoxCollider(el);
      case 'CircleCollider':
        return this.parseCircleCollider(el);
      case 'PolygonCollider':
        return this.parsePolygonCollider(el);
      case 'Graphic':
        return this.parseGraphic(el);
      case 'Camera':
        return this.parseCamera(el);
      case 'ParticleEmitter':
        return this.parseParticleEmitter(el);
      case 'Animations':
        return this.parseAnimations(el);
      case 'AnimationController':
        return this.parseAnimationController(el);
      case 'StageDirectorController':
        return this.parseStageDirectorController(el);
      case 'GameObjectController':
        return this.parseGameObjectController(el);
      case 'SignalConfig':
        return this.parseSignalConfig(el);
      default:
        console.warn(`Unknown component type: ${type}`);
        return null;
    }
  }

  private static parseCircleCollider(el: Element): CircleColliderComponent {
    return {
      type: 'CircleCollider',
      radius: parseFloat(el.getAttribute('radius') || '0'),
      offset: {
        x: parseFloat(el.getAttribute('offsetX') || '0'),
        y: parseFloat(el.getAttribute('offsetY') || '0')
      }
    };
  }

  private static parsePolygonCollider(el: Element): PolygonColliderComponent {
    const pointsStr = el.getAttribute('points') || '';
    const points = pointsStr.split(' ').map(p => {
      const [x, y] = p.split(',').map(s => parseFloat(s.trim()));
      return { x, y };
    });
    return {
      type: 'PolygonCollider',
      points
    };
  }

  private static parseGraphic(el: Element): GraphicComponent {
    const kind = el.getAttribute('kind') as any;
    const fillColor = el.getAttribute('fillColor');
    const fillAlpha = el.getAttribute('fillAlpha');
    const strokeColor = el.getAttribute('strokeColor');
    const strokeWidth = el.getAttribute('strokeWidth');
    const strokeAlpha = el.getAttribute('strokeAlpha');

    const graphic: GraphicComponent = {
      type: 'Graphic',
      kind,
      fill: fillColor ? { color: fillColor, alpha: parseFloat(fillAlpha || '1') } : undefined,
      stroke: strokeColor ? { color: strokeColor, width: parseFloat(strokeWidth || '1'), alpha: parseFloat(strokeAlpha || '1') } : undefined,
      width: parseFloat(el.getAttribute('width') || '0') || undefined,
      height: parseFloat(el.getAttribute('height') || '0') || undefined,
      radius: parseFloat(el.getAttribute('radius') || '0') || undefined,
    };

    const anchorStr = el.getAttribute('anchor');
    if (anchorStr) {
      const [ax, ay] = anchorStr.split(',').map((s) => parseFloat(s.trim()));
      if (Number.isFinite(ax) || Number.isFinite(ay)) {
        graphic.anchor = {
          x: Number.isFinite(ax) ? ax : 0,
          y: Number.isFinite(ay) ? ay : 0,
        };
      }
    }

    const pointsStr = el.getAttribute('points');
    if (pointsStr) {
      graphic.points = pointsStr.split(' ').map(p => {
        const [x, y] = p.split(',').map(s => parseFloat(s.trim()));
        return { x, y };
      });
    }

    return graphic;
  }

  private static parseTransform(el: Element): TransformComponent {
    const posStr = el.getAttribute('position') || '0, 0, 0';
    const parent = el.getAttribute('parent') || undefined;
    const rotStr = el.getAttribute('rotation') || '0';
    const scaleStr = el.getAttribute('scale') || '1, 1, 1';

    const [px, py, pz] = posStr.split(',').map(s => parseFloat(s.trim()) || 0);
    const [sx, sy, sz] = scaleStr.split(',').map(s => parseFloat(s.trim()) || 1);

    return {
      type: 'Transform',
      position: { x: px, y: py, z: pz || 0 },
      parent,
      rotation: (parseFloat(rotStr) || 0) * (Math.PI / 180), // 转换为弧度
      scale: { x: sx, y: sy, z: sz || 1 }
    };
  }

  private static parseSprite(el: Element): SpriteComponent {
    const texturePath = el.getAttribute('texture') || '';
    const anchorStr = el.getAttribute('anchor') || '0.5, 0.5';
    const [ax, ay] = anchorStr.split(',').map(s => parseFloat(s.trim()) || 0.5);
    const tintStr = el.getAttribute('tint') || '0xffffff';

    return {
      type: 'Sprite',
      texture: { kind: 'image', image: texturePath },
      anchor: { x: ax, y: ay },
      alpha: parseFloat(el.getAttribute('alpha') || '1'),
      visible: el.getAttribute('visible') !== 'false',
      blendMode: (el.getAttribute('blendMode') as any) || 'normal',
      tint: parseInt(tintStr.startsWith('0x') ? tintStr : `0x${tintStr.replace('#', '')}`, 16),
      layer: parseInt(el.getAttribute('layer') || '0', 10)
    };
  }

  private static parseRigidBody(el: Element): RigidBodyComponent {
    const velStr = el.getAttribute('linearVelocity') || '0, 0';
    const [vx, vy] = velStr.split(',').map(s => parseFloat(s.trim()) || 0);
    const emitsAttr = (el.getAttribute('emits') || '').trim();
    const allowedEmits: RigidBodyComponent['allowedEmits'] = emitsAttr
      ? emitsAttr
          .split(',')
          .map((item) => item.trim())
          .filter(isRigidBodyEmitName)
      : ['sensor.enter', 'sensor.stay', 'sensor.exit'];

    return {
      type: 'RigidBody',
      mass: parseFloat(el.getAttribute('mass') || '1.0'),
      bodyType: (el.getAttribute('type') as any) || 'dynamic',
      linearVelocity: { x: vx, y: vy },
      angularVelocity: parseFloat(el.getAttribute('angularVelocity') || '0'),
      fixedRotation: el.getAttribute('fixedRotation') === 'true',
      bullet: el.getAttribute('bullet') === 'true',
      sensor: el.getAttribute('sensor') === 'true',
      allowedEmits,
      gravityScale: parseFloat(el.getAttribute('gravityScale') || '1'),
      friction: parseFloat(el.getAttribute('friction') || '0.5'),
      restitution: parseFloat(el.getAttribute('restitution') || '0.2'),
      density: parseFloat(el.getAttribute('density') || '1.0')
    };
  }

  private static parseBoxCollider(el: Element): BoxColliderComponent {
    return {
      type: 'BoxCollider',
      width: parseFloat(el.getAttribute('width') || '0'),
      height: parseFloat(el.getAttribute('height') || '0'),
      offset: {
        x: parseFloat(el.getAttribute('offsetX') || '0'),
        y: parseFloat(el.getAttribute('offsetY') || '0')
      }
    };
  }

  private static parseCamera(el: Element): CameraComponent {
    return {
      type: 'Camera',
      x: parseFloat(el.getAttribute('x') || '0'),
      y: parseFloat(el.getAttribute('y') || '0'),
      z: parseFloat(el.getAttribute('z') || '0'),
      focus: parseFloat(el.getAttribute('focus') || '400'),
    };
  }

  private static parseParticleEmitter(el: Element): ParticleEmitterComponent {
    const texturePath = el.getAttribute('texture');
    const graphicKind = el.getAttribute('graphicKind') as 'circleGraphic' | 'squareGraphic' | null;
    return {
      type: 'ParticleEmitter',
      maxParticles: parseInt(el.getAttribute('maxParticles') || '200', 10),
      emissionRate: parseFloat(el.getAttribute('emissionRate') || '30'),
      texture: texturePath ? { kind: 'image', image: texturePath } : undefined,
      graphicKind: graphicKind || undefined,
      lifetimeMin: parseFloat(el.getAttribute('lifetimeMin') || '0.5'),
      lifetimeMax: parseFloat(el.getAttribute('lifetimeMax') || '1.5'),
      speedMin: parseFloat(el.getAttribute('speedMin') || '50'),
      speedMax: parseFloat(el.getAttribute('speedMax') || '120'),
      angle: parseFloat(el.getAttribute('angle') || '-90'),
      spread: parseFloat(el.getAttribute('spread') || '45'),
      startColor: el.getAttribute('startColor') || '#ffaa00',
      endColor: el.getAttribute('endColor') || '#ff0000',
      startSize: parseFloat(el.getAttribute('startSize') || '1.5'),
      endSize: parseFloat(el.getAttribute('endSize') || '0.2'),
      startAlpha: parseFloat(el.getAttribute('startAlpha') || '1'),
      endAlpha: parseFloat(el.getAttribute('endAlpha') || '0'),
      blendMode: (el.getAttribute('blendMode') as any) || 'add',
      anchor: parseAnchor(el.getAttribute('anchor') || '0.5, 0.5'),
    };
  }

  private static parseAnimations(el: Element): AnimationsComponent {
    const labels: AnimationsComponent['labels'] = {};
    for (const labelEl of this.getDirectChildren(el)) {
      if (labelEl.tagName !== 'Label') continue;
      const name = (labelEl.getAttribute('name') || '').trim();
      if (!name) continue;

      const tracks = [];
      for (const trackEl of this.getDirectChildren(labelEl)) {
        if (trackEl.tagName !== 'Track') continue;
        const prop = (trackEl.getAttribute('prop') || '').trim();
        if (!prop) continue;
        const interpolationAttr = (trackEl.getAttribute('interpolation') || 'hold').toLowerCase();
        const interpolation: 'hold' | 'linear' =
          interpolationAttr === 'linear' ? 'linear' : 'hold';
        const valueModeAttr = (trackEl.getAttribute('valueMode') || 'absolute').toLowerCase();
        const valueMode: 'absolute' | 'relative' =
          valueModeAttr === 'relative' ? 'relative' : 'absolute';
        const keys = [];

        for (const keyEl of this.getDirectChildren(trackEl)) {
          if (keyEl.tagName !== 'Key') continue;
          const frame = parseFloat(keyEl.getAttribute('frame') || '0');
          const valueRaw = keyEl.getAttribute('value');
          if (valueRaw === null) continue;
          const easing = keyEl.getAttribute('easing')?.trim();
          const events = this.parseAnimationKeyEvents(keyEl);
          keys.push({
            frame: Number.isFinite(frame) ? frame : 0,
            value: parseAnimationValue(valueRaw),
            easing: easing || undefined,
            events,
          });
        }

        keys.sort((left, right) => left.frame - right.frame);
        tracks.push({
          prop,
          interpolation,
          valueMode,
          keys,
        });
      }

      labels[name] = {
        name,
        duration: parseFloat(labelEl.getAttribute('duration') || '0'),
        loop: labelEl.getAttribute('loop') !== 'false',
        speed: parseFloat(labelEl.getAttribute('speed') || '1'),
        tracks,
      };
    }

    const defaultLabel = el.getAttribute('defaultLabel')?.trim() || undefined;
    return {
      type: 'Animations',
      defaultLabel,
      labels,
    };
  }

  private static parseAnimationController(el: Element): AnimationControllerComponent {
    const actionsAttr = (el.getAttribute('actions') || '').trim();
    const allowedActions = actionsAttr
      ? actionsAttr
          .split(',')
          .map((item) => item.trim())
          .filter(isAnimationActionName)
      : DEFAULT_ANIMATION_ACTIONS;

    const mode = parseAnimationControllerMode(el.getAttribute('mode'));
    const layerConflictPolicy = parseLayerConflictPolicy(el.getAttribute('layerConflictPolicy'));
    const layers = mode === 'layered' ? this.parseAnimationLayers(el) : [];

    return {
      type: 'AnimationController',
      mode,
      layerConflictPolicy,
      playing: el.getAttribute('playing') !== 'false',
      currentLabel: el.getAttribute('currentLabel')?.trim() || undefined,
      localFrame: parseFloat(el.getAttribute('localFrame') || '0'),
      speedScale: parseFloat(el.getAttribute('speedScale') || '1'),
      direction: parseAnimationDirection(el.getAttribute('direction')),
      loopOverride: parseOptionalBoolean(el.getAttribute('loopOverride')),
      fallbackLabel: el.getAttribute('fallbackLabel')?.trim() || undefined,
      layers,
      allowedActions: allowedActions.length > 0 ? allowedActions : DEFAULT_ANIMATION_ACTIONS,
      actionRequests: createAnimationActionRequestState(
        allowedActions.length > 0 ? allowedActions : DEFAULT_ANIMATION_ACTIONS,
      ),
    };
  }

  private static parseAnimationLayers(controllerEl: Element): AnimationLayerConfig[] {
    const layersEl = this.getDirectChildByTag(controllerEl, 'Layers');
    if (!layersEl) return [];

    const layers: AnimationLayerConfig[] = [];
    for (const layerEl of this.getDirectChildren(layersEl)) {
      if (layerEl.tagName !== 'Layer') continue;
      const id = (layerEl.getAttribute('id') || '').trim();
      if (!id) continue;

      const stateEl = this.getDirectChildByTag(layerEl, 'State');
      const state = this.parseAnimationLayerState(stateEl);
      const writeMask = parseMaskList(layerEl.getAttribute('writeMask'));
      const blockMask = parseMaskList(layerEl.getAttribute('blockMask'));
      layers.push({
        id,
        priority: parseFloat(layerEl.getAttribute('priority') || '0') || 0,
        enabled: layerEl.getAttribute('enabled') !== 'false',
        weight: parseFloat(layerEl.getAttribute('weight') || '1') || 1,
        blendMode: parseLayerBlendMode(layerEl.getAttribute('blendMode')),
        writeMask,
        blockMask,
        state,
      });
    }
    return layers;
  }

  private static parseAnimationLayerState(stateEl: Element | undefined): AnimationLayerState {
    return {
      playing: !stateEl || stateEl.getAttribute('playing') !== 'false',
      currentLabel: stateEl?.getAttribute('currentLabel')?.trim() || undefined,
      localFrame: parseFloat(stateEl?.getAttribute('localFrame') || '0') || 0,
      speedScale: parseFloat(stateEl?.getAttribute('speedScale') || '1') || 1,
      direction: parseAnimationDirection(stateEl?.getAttribute('direction') || null),
      loopOverride: parseOptionalBoolean(stateEl?.getAttribute('loopOverride') || null),
      fallbackLabel: stateEl?.getAttribute('fallbackLabel')?.trim() || undefined,
    };
  }

  private static parseAnimationKeyEvents(
    keyEl: Element,
  ): Array<{
    signal: string;
    once: boolean;
    phase: 'enter' | 'leave' | 'exact';
    direction: 'both' | 'forward' | 'backward';
    fireOnSeek: boolean;
    cooldownMs: number;
    sets: Array<{ key: string; from?: string; value?: number | string | boolean }>;
  }> {
    const eventsEl = this.getDirectChildByTag(keyEl, 'Events');
    if (!eventsEl) return [];

    const events: Array<{
      signal: string;
      once: boolean;
      phase: 'enter' | 'leave' | 'exact';
      direction: 'both' | 'forward' | 'backward';
      fireOnSeek: boolean;
      cooldownMs: number;
      sets: Array<{ key: string; from?: string; value?: number | string | boolean }>;
    }> = [];

    for (const eventEl of this.getDirectChildren(eventsEl)) {
      if (eventEl.tagName !== 'Event') continue;
      const signal = (eventEl.getAttribute('signal') || '').trim();
      if (!signal) continue;
      const payloadEl = this.getDirectChildByTag(eventEl, 'Payload');
      const sets: Array<{ key: string; from?: string; value?: number | string | boolean }> = [];
      if (payloadEl) {
        for (const setEl of this.getDirectChildren(payloadEl)) {
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

      events.push({
        signal,
        once: eventEl.getAttribute('once') !== 'false',
        phase: parseAnimationKeyEventPhase(eventEl.getAttribute('phase')),
        direction: parseAnimationKeyEventDirection(eventEl.getAttribute('direction')),
        fireOnSeek: eventEl.getAttribute('fireOnSeek') === 'true',
        cooldownMs: Math.max(0, parseFloat(eventEl.getAttribute('cooldownMs') || '0') || 0),
        sets,
      });
    }

    return events;
  }

  private static parseStageDirectorController(el: Element): StageDirectorControllerComponent {
    const actionsAttr = (el.getAttribute('actions') || '').trim();
    const allowedActions = actionsAttr
      ? actionsAttr
          .split(',')
          .map((item) => item.trim())
          .filter(isStageDirectorActionName)
      : DEFAULT_STAGE_DIRECTOR_ACTIONS;
    const id = (el.getAttribute('id') || '').trim();
    const scope = (el.getAttribute('scope') || '').trim();

    return {
      type: 'StageDirectorController',
      id: id || `director_${scope || 'default'}`,
      scope: scope || 'default',
      enabled: el.getAttribute('enabled') !== 'false',
      conflictPolicy: parseStageDirectorConflictPolicy(el.getAttribute('conflictPolicy')),
      maxActiveInstances: Math.max(1, parseInt(el.getAttribute('maxActiveInstances') || '16', 10) || 16),
      defaultPriority: parseInt(el.getAttribute('defaultPriority') || '0', 10) || 0,
      allowCrossScope: el.getAttribute('allowCrossScope') === 'true',
      allowedActions: allowedActions.length > 0 ? allowedActions : DEFAULT_STAGE_DIRECTOR_ACTIONS,
      actionRequests: createStageDirectorActionRequestState(
        allowedActions.length > 0 ? allowedActions : DEFAULT_STAGE_DIRECTOR_ACTIONS,
      ),
    };
  }

  private static parseGameObjectController(el: Element): GameObjectControllerComponent {
    const actionsAttr = (el.getAttribute('actions') || '').trim();
    const allowedActions: GameObjectControllerActionName[] = actionsAttr
      ? actionsAttr
          .split(',')
          .map((item) => item.trim())
          .filter(isGameObjectControllerActionName)
      : ['destroy'];

    return {
      type: 'GameObjectController',
      alive: el.getAttribute('alive') !== 'false',
      destroyable: el.getAttribute('destroyable') !== 'false',
      destroyDelayMs: parseInt(el.getAttribute('destroyDelayMs') || '0', 10) || 0,
      allowedActions,
      actionRequests: createGameObjectControllerActionRequestState(allowedActions),
      pendingDestroy: false,
      destroyAt: null,
      destroyReason: undefined,
    };
  }

  private static parseSignalConfig(el: Element): SignalConfigComponent {
    const rules: SignalConfigComponent['rules'] = [];

    for (const childEl of this.getDirectChildren(el)) {
      const whenEl = this.getDirectChildByTag(childEl, 'When');
      const argsEl = this.getDirectChildByTag(childEl, 'Args');
      const args: Record<string, string | number | boolean> = {};
      if (argsEl) {
        for (let i = 0; i < argsEl.attributes.length; i++) {
          const attr = argsEl.attributes.item(i);
          if (!attr) continue;
          args[attr.name] = parseLoosePrimitive(attr.value);
        }
      }

      if (childEl.tagName === 'On') {
        const event = (childEl.getAttribute('event') || '').trim();
        const target = (childEl.getAttribute('target') || '').trim();
        const action = (childEl.getAttribute('action') || '').trim();
        if (!event || !target || !action) continue;
        rules.push({
          kind: 'action',
          event,
          target,
          action,
          when: whenEl?.getAttribute('expr')?.trim() || undefined,
          args,
          priority: parseInt(childEl.getAttribute('priority') || '0', 10) || 0,
        });
        continue;
      }

      if (childEl.tagName === 'Emit') {
        const from = (childEl.getAttribute('from') || '').trim();
        const emit = (childEl.getAttribute('emit') || '').trim();
        const signal = (childEl.getAttribute('signal') || '').trim();
        if (!from || !emit || !signal) continue;
        rules.push({
          kind: 'emit',
          from,
          emit,
          signal,
          when: whenEl?.getAttribute('expr')?.trim() || undefined,
          args,
          priority: parseInt(childEl.getAttribute('priority') || '0', 10) || 0,
        });
      }
    }

    rules.sort((left, right) => right.priority - left.priority);
    return {
      type: 'SignalConfig',
      rules,
    };
  }
}

const DEFAULT_ANIMATION_ACTIONS: AnimationActionName[] = [
  'setLabel',
  'playOnce',
  'pause',
  'resume',
  'setSpeed',
  'setLoopOverride',
  'setLayerLabel',
  'playLayerOnce',
  'pauseLayer',
  'resumeLayer',
  'setLayerWeight',
  'enableLayer',
  'disableLayer',
];

const DEFAULT_STAGE_DIRECTOR_ACTIONS: StageDirectorActionName[] = [
  'playScript',
  'stopScript',
  'stopAll',
  'pauseScript',
  'resumeScript',
];

function createAnimationActionRequestState(
  allowedActions: readonly AnimationActionName[],
): AnimationControllerComponent['actionRequests'] {
  const state: AnimationControllerComponent['actionRequests'] = {};
  for (const action of allowedActions) {
    state[action] = {
      pending: false,
      args: {},
    };
  }
  return state;
}

function parseAnchor(anchorStr: string): { x: number; y: number } {
  const [x, y] = anchorStr.split(',').map((s) => parseFloat(s.trim()));
  return {
    x: Number.isFinite(x) ? x : 0.5,
    y: Number.isFinite(y) ? y : 0.5,
  };
}

function parseOptionalBoolean(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

function parseAnimationValue(value: string): number | string | boolean {
  const normalized = value.trim();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    return parseFloat(normalized);
  }
  return value;
}

function parseLoosePrimitive(value: string): string | number | boolean {
  const normalized = value.trim();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(normalized)) {
    return parseFloat(normalized);
  }
  return value;
}

function isInputRoutePhase(value: string): value is InputRoutePhase {
  return value === 'pressed' || value === 'released' || value === 'held' || value === 'changed';
}

function isAnimationActionName(value: string): value is AnimationActionName {
  return (
    value === 'setLabel' ||
    value === 'playOnce' ||
    value === 'pause' ||
    value === 'resume' ||
    value === 'setSpeed' ||
    value === 'setLoopOverride' ||
    value === 'setLayerLabel' ||
    value === 'playLayerOnce' ||
    value === 'pauseLayer' ||
    value === 'resumeLayer' ||
    value === 'setLayerWeight' ||
    value === 'enableLayer' ||
    value === 'disableLayer'
  );
}

function isStageDirectorActionName(value: string): value is StageDirectorActionName {
  return (
    value === 'playScript' ||
    value === 'stopScript' ||
    value === 'stopAll' ||
    value === 'pauseScript' ||
    value === 'resumeScript'
  );
}

function parseAnimationDirection(value: string | null): AnimationDirection {
  return value === 'backward' ? 'backward' : 'forward';
}

function parseAnimationKeyEventPhase(value: string | null): 'enter' | 'leave' | 'exact' {
  if (value === 'leave' || value === 'exact') return value;
  return 'enter';
}

function parseAnimationKeyEventDirection(value: string | null): 'both' | 'forward' | 'backward' {
  if (value === 'forward' || value === 'backward') return value;
  return 'both';
}

function parseAnimationControllerMode(value: string | null): AnimationControllerMode {
  return value === 'layered' ? 'layered' : 'single';
}

function parseStageInterpolation(value: string | null): StageScriptTrack['interpolation'] {
  return value === 'linear' ? 'linear' : 'hold';
}

function parseStageValueMode(value: string | null): StageScriptTrack['valueMode'] {
  return value === 'relative' ? 'relative' : 'absolute';
}

function parseInterruptPolicy(value: string | null): StageScriptAsset['interruptPolicy'] {
  if (value === 'reject' || value === 'queue') return value;
  return 'replace';
}

function parseUnknownScriptPolicy(value: string | null): StageScriptLibraryAsset['unknownScript'] {
  if (value === 'warn' || value === 'ignore') return value;
  return 'error';
}

function parseLayerConflictPolicy(value: string | null): AnimationLayerConflictPolicy {
  if (value === 'priority' || value === 'weight') return value;
  return 'byMask';
}

function parseLayerBlendMode(value: string | null): AnimationLayerConfig['blendMode'] {
  return value === 'additive' ? 'additive' : 'override';
}

function parseStageDirectorConflictPolicy(
  value: string | null,
): StageDirectorControllerComponent['conflictPolicy'] {
  if (value === 'stageFirst' || value === 'byMask') return value;
  return 'localFirst';
}

function parseMaskList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isGameObjectControllerActionName(value: string): value is GameObjectControllerActionName {
  return value === 'destroy';
}

function isRigidBodyEmitName(value: string): value is 'sensor.enter' | 'sensor.stay' | 'sensor.exit' {
  return value === 'sensor.enter' || value === 'sensor.stay' || value === 'sensor.exit';
}
