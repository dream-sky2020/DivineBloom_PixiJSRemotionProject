import type { AnyComponent, Entity, WorldData } from '../types';
import { parseCanvas } from './passes/parseCanvas';
import { parseEngineConfig } from './passes/parseEngineConfig';
import { parseComponentByRegistry } from './components/componentParsers';
import { getDirectChildByTag, getDirectChildren } from './xml/XmlDom';
import { sendDebugCommand } from '../../debug/DebugLogger';

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
  private static readonly DEBUG_ENABLED = true;

  static async parseWorld(xmlString: string): Promise<WorldData> {
    this.debug('parseWorld:start', { xmlLength: xmlString.length });
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    const worldElement = xmlDoc.getElementsByTagName('World')[0];
    
    if (!worldElement) {
      throw new Error('Invalid XML: Missing <World> root element');
    }

    const config = this.runStage('parseEngineConfig', () => parseEngineConfig(worldElement));

    const canvas = this.runStage('parseCanvas', () => parseCanvas(worldElement));

    const prefabRegistry = await this.runStageAsync('parsePrefabLibrary', () =>
      this.parsePrefabLibrary(worldElement),
    );
    const resolvedPrefabCache = new Map<string, ResolvedPrefabTemplate>();

    // Parse scene entities from direct World children
    const entities: Entity[] = [];
    const existingEntityIds = new Set<string>();
    let fallbackIdCounter = 0;

    const directChildren = getDirectChildren(worldElement);
    this.debug('parseWorld:children', {
      total: directChildren.length,
      tags: directChildren.map((child) => child.tagName),
    });

    for (let childIndex = 0; childIndex < directChildren.length; childIndex++) {
      const child = directChildren[childIndex];
      if (child.tagName === 'GameObject') {
        const entity = this.runStage(
          `parseGameObject[index=${childIndex}]`,
          () => this.parseGameObjectElement(child, `entity_${fallbackIdCounter++}`),
          {
            id: child.getAttribute('id') || undefined,
            name: child.getAttribute('name') || undefined,
          },
        );
        this.appendEntity(entities, existingEntityIds, entity);
        continue;
      }

      if (child.tagName === 'Instance') {
        const entity = this.runStage(
          `parseInstance[index=${childIndex}]`,
          () =>
            this.parseInstanceElement(
              child,
              prefabRegistry,
              resolvedPrefabCache,
              `entity_${fallbackIdCounter++}`,
            ),
          {
            id: child.getAttribute('id') || undefined,
            prefab: child.getAttribute('prefab') || undefined,
          },
        );
        this.appendEntity(entities, existingEntityIds, entity);
      }
    }

    this.debug('parseWorld:done', { entityCount: entities.length });
    return { config, canvas, entities };
  }

  private static async parsePrefabLibrary(worldEl: Element): Promise<Map<string, PrefabDefinition>> {
    const libraryEl = getDirectChildByTag(worldEl, 'PrefabLibrary');
    const prefabs = new Map<string, PrefabDefinition>();

    if (!libraryEl) return prefabs;

    for (const prefabEl of getDirectChildren(libraryEl)) {
      if (prefabEl.tagName !== 'Prefab') continue;

      const declaredId = prefabEl.getAttribute('id')?.trim();
      const src = prefabEl.getAttribute('src')?.trim();

      let extendsId = prefabEl.getAttribute('extends')?.trim() || undefined;
      let gameObjectEl = getDirectChildByTag(prefabEl, 'GameObject');
      let resolvedId = declaredId;

      if (src) {
        const loaded = await this.runStageAsync('loadPrefabDefinitionFromPublic', () =>
          this.loadPrefabDefinitionFromPublic(src),
        );
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
      this.debug('parsePrefabLibrary:item', {
        id: resolvedId,
        extendsId,
        fromSrc: src || undefined,
      });
    }

    this.debug('parsePrefabLibrary:done', { prefabCount: prefabs.size });
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
      const gameObjectEl = getDirectChildByTag(prefabRoot, 'GameObject');
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
      const prefabEls = getDirectChildren(prefabRoot).filter((child) => child.tagName === 'Prefab');
      if (prefabEls.length === 0) {
        throw new Error(`Invalid XML: Prefab file "${src}" has no <Prefab> definition`);
      }
      const selectedPrefab = this.selectExportedPrefab(prefabEls, src);
      const gameObjectEl = getDirectChildByTag(selectedPrefab, 'GameObject');
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
      const externalLibrary = getDirectChildByTag(prefabRoot, 'PrefabLibrary');
      if (!externalLibrary) {
        throw new Error(`Invalid XML: World prefab file "${src}" must contain <PrefabLibrary>`);
      }

      const prefabEls = getDirectChildren(externalLibrary).filter((child) => child.tagName === 'Prefab');
      if (prefabEls.length === 0) {
        throw new Error(`Invalid XML: World prefab file "${src}" has no <Prefab> definition`);
      }

      const selectedPrefab = this.selectExportedPrefab(prefabEls, src);
      const gameObjectEl = getDirectChildByTag(selectedPrefab, 'GameObject');
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
    for (const overrideEl of getDirectChildren(instanceEl)) {
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

    for (const child of getDirectChildren(parent)) {
      map.set(child.tagName, child);
    }

    return map;
  }

  private static parseComponentsFromElement(parent: Element): Map<string, AnyComponent> {
    return this.parseComponentsFromMap(this.collectComponentElements(parent));
  }

  private static parseComponentsFromMap(componentEls: Map<string, Element>): Map<string, AnyComponent> {
    const components = new Map<string, AnyComponent>();
    const interfaceEl = componentEls.get('Interface');

    for (const [type, componentEl] of componentEls.entries()) {
      if (type === 'Interface') continue; // Interface 不是独立组件

      const component = this.runStage(
        `parseComponent[type=${type}]`,
        () => (type === 'SignalConfig'
          ? parseComponentByRegistry(componentEl, { interfaceEl })
          : parseComponentByRegistry(componentEl)),
      );

      if (component) {
        components.set(component.type, component);
      }
    }

    // 如果有 Interface 但没有 SignalConfig，自动创建一个空的 SignalConfig 来存放接口
    if (interfaceEl && !components.has('SignalConfig')) {
      const virtualSignalConfigEl = document.createElement('SignalConfig');
      const component = this.runStage('parseComponent[type=SignalConfig][virtual]', () =>
        parseComponentByRegistry(virtualSignalConfigEl, { interfaceEl }),
      );
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
    
    // 合并属性
    for (let i = 0; i < overrideEl.attributes.length; i++) {
      const attr = overrideEl.attributes.item(i);
      if (!attr) continue;
      merged.setAttribute(attr.name, attr.value);
    }

    // 对于 SignalConfig，合并子元素（追加规则）
    if (overrideEl.tagName === 'SignalConfig') {
      for (const child of getDirectChildren(overrideEl)) {
        merged.appendChild(child.cloneNode(true));
      }
    } else if (overrideEl.tagName === 'Animation') {
        // Animation 通常是覆盖整个标签，或者合并 Label？
        // 这里简单处理，如果有子元素则清空原有的并使用新的
        if (overrideEl.children.length > 0) {
            while (merged.firstChild) {
                merged.removeChild(merged.firstChild);
            }
            for (const child of getDirectChildren(overrideEl)) {
                merged.appendChild(child.cloneNode(true));
            }
        }
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

  private static runStage<T>(stage: string, fn: () => T, detail?: Record<string, unknown>): T {
    this.debug(`${stage}:start`, detail);
    try {
      const result = fn();
      this.debug(`${stage}:ok`);
      return result;
    } catch (error) {
      this.debug(`${stage}:error`, { detail, error: this.stringifyError(error) });
      throw this.wrapError(stage, error, detail);
    }
  }

  private static async runStageAsync<T>(
    stage: string,
    fn: () => Promise<T>,
    detail?: Record<string, unknown>,
  ): Promise<T> {
    this.debug(`${stage}:start`, detail);
    try {
      const result = await fn();
      this.debug(`${stage}:ok`);
      return result;
    } catch (error) {
      this.debug(`${stage}:error`, { detail, error: this.stringifyError(error) });
      throw this.wrapError(stage, error, detail);
    }
  }

  private static wrapError(stage: string, error: unknown, detail?: Record<string, unknown>): Error {
    const baseMessage = error instanceof Error ? error.message : String(error);
    const detailSuffix = detail ? ` | detail=${JSON.stringify(detail)}` : '';
    return new Error(`[XmlParser:${stage}] ${baseMessage}${detailSuffix}`);
  }

  private static stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    return String(error);
  }

  private static debug(message: string, payload?: Record<string, unknown>): void {
    if (!this.DEBUG_ENABLED) return;
    sendDebugCommand({
      level: 'DEBUG',
      source: 'XmlParser',
      message,
      detail: payload,
    });
  }

}
