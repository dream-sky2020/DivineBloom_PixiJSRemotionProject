import type {
  BlendMode,
  ParticleContainerData,
  ParticleData,
  RenderDocument,
  SceneFrame,
  SpriteData,
} from '../types/rendering';

export interface ParsedDslFrame {
  frameId: string;
  scene: SceneFrame;
}

export interface ParsedRenderingDsl {
  document: RenderDocument;
  frames: ParsedDslFrame[];
}

type DslAttributes = Record<string, string>;

const VALID_BLEND_MODES = new Set<BlendMode>([
  'none',
  'normal',
  'add',
  'multiply',
  'subtract',
  'screen',
]);

export function parseRenderingDsl(dsl: string): ParsedRenderingDsl {
  assertDoubleQuotedAttributes(dsl);
  const documentElement = parseXmlDocument(dsl);
  const document = elementToRenderDocument(documentElement);
  const frames = document.frames.map((scene) => ({ frameId: scene.id, scene }));

  return {
    document,
    frames,
  };
}

export function parseRenderingDslFrame(dsl: string, frameId = '0'): SceneFrame {
  const parsed = parseRenderingDsl(dsl);
  return (
    parsed.frames.find((frame) => frame.frameId === frameId)?.scene ??
    parsed.frames[0]?.scene ?? { id: frameId, cameraX: 0, cameraY: 0, objects: [] }
  );
}

function assertDoubleQuotedAttributes(dsl: string) {
  const singleQuotedAttribute = /<[^>]*\s[A-Za-z_][\w-]*\s*=\s*'[^']*'/m.exec(dsl);
  if (singleQuotedAttribute) {
    throw new Error(`属性值必须使用双引号包裹：${singleQuotedAttribute[0]}`);
  }
}

function parseXmlDocument(dsl: string) {
  const document = new DOMParser().parseFromString(dsl, 'application/xml');
  const parseError = document.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML 解析失败：${parseError.textContent?.trim() || '格式不合法'}`);
  }

  return document.documentElement;
}

function elementToRenderDocument(documentElement: Element): RenderDocument {
  if (documentElement.tagName === 'Image') {
    return elementToImageDocument(documentElement);
  }
  if (documentElement.tagName === 'Video') {
    return elementToVideoDocument(documentElement);
  }

  throw new Error('渲染 DSL 根节点必须是 Image 或 Video');
}

function elementToImageDocument(documentElement: Element): RenderDocument {
  const attributes = elementAttributes(documentElement);
  const frames = readRootFrames(documentElement);
  if (frames.length !== 1) {
    throw new Error('Image 根节点必须且只能包含 1 个 FRAME');
  }

  return {
    type: 'image',
    name: readRequiredString(attributes, 'name', 'Image'),
    width: readRequiredPositiveInteger(attributes, 'width', 'Image'),
    height: readRequiredPositiveInteger(attributes, 'height', 'Image'),
    transparent: readOptionalBoolean(attributes.transparent, 'transparent') ?? false,
    frames,
  };
}

function elementToVideoDocument(documentElement: Element): RenderDocument {
  const attributes = elementAttributes(documentElement);
  const width = readRequiredPositiveInteger(attributes, 'width', 'Video');
  const height = readRequiredPositiveInteger(attributes, 'height', 'Video');
  const fps = readRequiredPositiveInteger(attributes, 'fps', 'Video');
  const totalFrames = readRequiredPositiveInteger(attributes, 'totalFrames', 'Video');

  return {
    type: 'video',
    name: readRequiredString(attributes, 'name', 'Video'),
    width,
    height,
    fps,
    totalFrames,
    frames: readRootFrames(documentElement),
  };
}

function readRootFrames(documentElement: Element) {
  const frames = childElements(documentElement).map((frameElement) => {
    if (frameElement.tagName !== 'FRAME') {
      throw new Error(`${documentElement.tagName} 不支持子节点 ${frameElement.tagName}`);
    }

    return elementToFrame(frameElement);
  });

  if (frames.length === 0) {
    throw new Error(`${documentElement.tagName} 根节点至少需要 1 个 FRAME`);
  }

  return frames;
}

function elementToFrame(frameElement: Element): SceneFrame {
  const attributes = elementAttributes(frameElement);
  const frame: SceneFrame = {
    id: readRequiredString(attributes, 'id', 'FRAME'),
    cameraX: readOptionalNumber(attributes.cameraX, 'cameraX') ?? 0,
    cameraY: readOptionalNumber(attributes.cameraY, 'cameraY') ?? 0,
    objects: [],
  };

  for (const element of childElements(frameElement)) {
    if (element.tagName === 'SPRITE') {
      frame.objects.push({ type: 'sprite', data: elementToSprite(element) });
    } else if (element.tagName === 'PARTICLECONTAINER') {
      frame.objects.push({
        type: 'particleContainer',
        data: elementToParticleContainer(element),
      });
    } else {
      throw new Error(`FRAME 不支持子节点 ${element.tagName}`);
    }
  }

  return frame;
}

function elementToSprite(spriteElement: Element): SpriteData {
  const attributes = elementAttributes(spriteElement);
  const atlas = readOptionalString(attributes, 'atlas');
  const frame = readOptionalString(attributes, 'frame');
  const image = readOptionalString(attributes, 'image');

  if (image && (atlas || frame)) {
    throw new Error('SPRITE 使用 image 时不能同时填写 atlas 或 frame');
  }
  if (!image && (!atlas || !frame)) {
    throw new Error('SPRITE 必须填写 image，或同时填写 atlas 和 frame');
  }

  return {
    type: 'sprite',
    id: readRequiredString(attributes, 'id', 'SPRITE'),
    atlas,
    frame,
    image,
    x: readRequiredNumber(attributes, 'x', 'SPRITE'),
    y: readRequiredNumber(attributes, 'y', 'SPRITE'),
    anchorX: readOptionalNumber(attributes.anchorX, 'anchorX') ?? 0.5,
    anchorY: readOptionalNumber(attributes.anchorY, 'anchorY') ?? 0.5,
    zIndex: readOptionalInteger(attributes.zIndex, 'zIndex') ?? 0,
    scaleX: readOptionalNumber(attributes.scaleX, 'scaleX') ?? 1,
    scaleY: readOptionalNumber(attributes.scaleY, 'scaleY') ?? 1,
    rotation: readOptionalNumber(attributes.rotation, 'rotation') ?? 0,
    alpha: readOptionalNumber(attributes.alpha, 'alpha') ?? 1,
    visible: readOptionalBoolean(attributes.visible, 'visible') ?? true,
    blendMode: readBlendMode(attributes.blendMode),
    tint: readOptionalColor(attributes.tint, 'tint') ?? 0xffffff,
  };
}

function elementToParticleContainer(containerElement: Element): ParticleContainerData {
  const attributes = elementAttributes(containerElement);
  const id = readRequiredString(attributes, 'id', 'PARTICLECONTAINER');
  const particles = childElements(containerElement, 'PARTICLE').map((particleElement) =>
    elementToParticle(particleElement, id),
  );

  return {
    type: 'particleContainer',
    id,
    atlas: readRequiredString(attributes, 'atlas', 'PARTICLECONTAINER'),
    zIndex: readOptionalInteger(attributes.zIndex, 'zIndex') ?? 0,
    blendMode: readBlendMode(attributes.blendMode),
    particles,
  };
}

function elementToParticle(particleElement: Element, containerId: string): ParticleData {
  const attributes = elementAttributes(particleElement);
  const particleContainer = readRequiredString(attributes, 'particleContainer', 'PARTICLE');
  if (particleContainer !== containerId) {
    throw new Error(`PARTICLE ${attributes.id ?? ''} 的 particleContainer 必须等于父容器 ${containerId}`);
  }

  return {
    type: 'particle',
    id: readRequiredString(attributes, 'id', 'PARTICLE'),
    particleContainer,
    frame: readRequiredString(attributes, 'frame', 'PARTICLE'),
    x: readRequiredNumber(attributes, 'x', 'PARTICLE'),
    y: readRequiredNumber(attributes, 'y', 'PARTICLE'),
    scaleX: readOptionalNumber(attributes.scaleX, 'scaleX') ?? 1,
    scaleY: readOptionalNumber(attributes.scaleY, 'scaleY') ?? 1,
    anchorX: readOptionalNumber(attributes.anchorX, 'anchorX') ?? 0.5,
    anchorY: readOptionalNumber(attributes.anchorY, 'anchorY') ?? 0.5,
    rotation: readOptionalNumber(attributes.rotation, 'rotation') ?? 0,
    alpha: readOptionalNumber(attributes.alpha, 'alpha') ?? 1,
    tint: readOptionalColor(attributes.tint, 'tint') ?? 0xffffff,
  };
}

function childElements(parent: Element, tagName?: string) {
  return Array.from(parent.children).filter((child) => {
    return tagName === undefined || child.tagName === tagName;
  });
}

function elementAttributes(element: Element): DslAttributes {
  const attributes: DslAttributes = {};
  for (const name of element.getAttributeNames()) {
    attributes[name] = element.getAttribute(name) ?? '';
  }

  return attributes;
}

function readRequiredString(attributes: DslAttributes, key: string, nodeName: string) {
  const value = attributes[key];
  if (!value) {
    throw new Error(`${nodeName} 缺少必填属性 ${key}`);
  }

  return value;
}

function readOptionalString(attributes: DslAttributes, key: string) {
  const value = attributes[key];
  return value === undefined || value === '' ? undefined : value;
}

function readRequiredNumber(attributes: DslAttributes, key: string, nodeName: string) {
  const value = attributes[key];
  const parsed = readOptionalNumber(value, key);
  if (parsed === undefined) {
    throw new Error(`${nodeName} 缺少必填数字属性 ${key}`);
  }

  return parsed;
}

function readRequiredInteger(attributes: DslAttributes, key: string, nodeName: string) {
  const value = attributes[key];
  const parsed = readOptionalInteger(value, key);
  if (parsed === undefined) {
    throw new Error(`${nodeName} 缺少必填整数属性 ${key}`);
  }

  return parsed;
}

function readRequiredPositiveInteger(attributes: DslAttributes, key: string, nodeName: string) {
  const parsed = readRequiredInteger(attributes, key, nodeName);
  if (parsed <= 0) {
    throw new Error(`${key} 必须是正整数`);
  }

  return parsed;
}

function readOptionalNumber(value: string | undefined, key: string) {
  if (value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${key} 必须是有效数字`);
  }

  return parsed;
}

function readOptionalInteger(value: string | undefined, key: string) {
  const parsed = readOptionalNumber(value, key);
  if (parsed === undefined) {
    return undefined;
  }

  if (!Number.isInteger(parsed)) {
    throw new Error(`${key} 必须是整数`);
  }

  return parsed;
}

function readOptionalBoolean(value: string | undefined, key: string) {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }

  throw new Error(`${key} 必须是 true 或 false`);
}

function readOptionalColor(value: string | undefined, key: string) {
  if (!value) {
    return undefined;
  }

  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  const parsed = Number.parseInt(normalized, 16);
  if (!/^[\da-f]{6}$/i.test(normalized) || !Number.isFinite(parsed)) {
    throw new Error(`${key} 必须是 0xRRGGBB 格式`);
  }

  return parsed;
}

function readBlendMode(value: string | undefined) {
  if (!value) {
    return 'normal';
  }

  if (!VALID_BLEND_MODES.has(value as BlendMode)) {
    throw new Error(`blendMode 仅支持 ${Array.from(VALID_BLEND_MODES).join(', ')}`);
  }

  return value as BlendMode;
}
