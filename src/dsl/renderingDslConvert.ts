import type {
  BlendMode,
  CanvasRenderDocument,
  CameraData,
  SpriteData,
  ParticleContainerData,
  ParticleData,
  CameraKeyframe,
  SpriteKeyframe,
  ParticleContainerKeyframe,
  ParticleKeyframe,
} from './types';

export interface ParsedRenderingDsl {
  document: CanvasRenderDocument;
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
  const document = elementToCanvasDocument(documentElement);

  return { document };
}

export function stringifyRenderingDsl(document: CanvasRenderDocument): string {
  if (document.type !== 'canvas') {
    throw new Error('仅支持导出 type 为 canvas 的文档');
  }

  const lines: string[] = [];
  lines.push(`<Canvas${buildAttributes({
    name: document.name ?? 'Untitled',
    width: document.width ?? 1920,
    height: document.height ?? 1080,
    fps: document.fps ?? 30,
    totalFrames: document.totalFrames ?? 1
  })}>`);

  for (const camera of document.cameras) {
    lines.push(`  <CAMERA${buildAttributes({ id: camera.id })}>`);
    for (const keyframe of camera.keyframes) {
      lines.push(`    <KEYFRAME${buildAttributes({
        frame: keyframe.frame,
        x: keyframe.x,
        y: keyframe.y
      })} />`);
    }
    lines.push('  </CAMERA>');
  }

  for (const sprite of document.sprites) {
    lines.push(`  <SPRITE${buildAttributes({ id: sprite.id })}>`);
    for (const keyframe of sprite.keyframes) {
      lines.push(`    <KEYFRAME${buildAttributes({
        frame: keyframe.frame,
        atlas: keyframe.atlas,
        atlasFrame: keyframe.atlasFrame,
        image: keyframe.image,
        x: keyframe.x,
        y: keyframe.y,
        anchorX: keyframe.anchorX,
        anchorY: keyframe.anchorY,
        zIndex: keyframe.zIndex,
        scaleX: keyframe.scaleX,
        scaleY: keyframe.scaleY,
        rotation: keyframe.rotation,
        alpha: keyframe.alpha,
        visible: keyframe.visible,
        blendMode: keyframe.blendMode,
        tint: serializeTint(keyframe.tint),
        active: keyframe.active
      })} />`);
    }
    lines.push('  </SPRITE>');
  }

  for (const container of document.particleContainers) {
    lines.push(`  <PARTICLECONTAINER${buildAttributes({ id: container.id })}>`);
    for (const keyframe of container.keyframes) {
      lines.push(`    <KEYFRAME${buildAttributes({
        frame: keyframe.frame,
        atlas: keyframe.atlas,
        zIndex: keyframe.zIndex,
        blendMode: keyframe.blendMode,
        visible: keyframe.visible,
        active: keyframe.active
      })} />`);
    }
    for (const particle of container.particles) {
      lines.push(`    <PARTICLE${buildAttributes({ id: particle.id })}>`);
      for (const keyframe of particle.keyframes) {
        lines.push(`      <KEYFRAME${buildAttributes({
          frame: keyframe.frame,
          atlasFrame: keyframe.atlasFrame,
          x: keyframe.x,
          y: keyframe.y,
          scaleX: keyframe.scaleX,
          scaleY: keyframe.scaleY,
          anchorX: keyframe.anchorX,
          anchorY: keyframe.anchorY,
          rotation: keyframe.rotation,
          alpha: keyframe.alpha,
          tint: serializeTint(keyframe.tint),
          active: keyframe.active
        })} />`);
      }
      lines.push('    </PARTICLE>');
    }
    lines.push('  </PARTICLECONTAINER>');
  }

  lines.push('</Canvas>');
  return `${lines.join('\n')}\n`;
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

function elementToCanvasDocument(documentElement: Element): CanvasRenderDocument {
  if (documentElement.tagName !== 'Canvas') {
    throw new Error('渲染 DSL 根节点必须是 Canvas');
  }

  const attributes = elementAttributes(documentElement);
  
  const document: CanvasRenderDocument = {
    type: 'canvas',
    name: readOptionalString(attributes, 'name') ?? 'Untitled',
    width: readOptionalInteger(attributes.width, 'width') ?? 1920,
    height: readOptionalInteger(attributes.height, 'height') ?? 1080,
    fps: readOptionalInteger(attributes.fps, 'fps') ?? 30,
    totalFrames: readOptionalInteger(attributes.totalFrames, 'totalFrames') ?? 1,
    cameras: [],
    sprites: [],
    particleContainers: []
  };

  for (const child of childElements(documentElement)) {
    if (child.tagName === 'CAMERA') {
      document.cameras.push(elementToCamera(child));
    } else if (child.tagName === 'SPRITE') {
      document.sprites.push(elementToSprite(child));
    } else if (child.tagName === 'PARTICLECONTAINER') {
      document.particleContainers.push(elementToParticleContainer(child));
    } else {
      throw new Error(`Canvas 不支持子节点 ${child.tagName}`);
    }
  }

  return document;
}

// ==========================================
// 实体解析逻辑
// ==========================================

function elementToCamera(cameraElement: Element): CameraData {
  const attributes = elementAttributes(cameraElement);
  const id = readRequiredString(attributes, 'id', 'CAMERA');
  const keyframes = childElements(cameraElement, 'KEYFRAME').map(elementToCameraKeyframe);

  if (keyframes.length === 0) {
    throw new Error(`CAMERA ${id} 至少需要 1 个 KEYFRAME`);
  }

  return { type: 'camera', id, keyframes };
}

function elementToSprite(spriteElement: Element): SpriteData {
  const attributes = elementAttributes(spriteElement);
  const id = readRequiredString(attributes, 'id', 'SPRITE');
  const keyframes = childElements(spriteElement, 'KEYFRAME').map(elementToSpriteKeyframe);

  if (keyframes.length === 0) {
    throw new Error(`SPRITE ${id} 至少需要 1 个 KEYFRAME`);
  }

  return { type: 'sprite', id, keyframes };
}

function elementToParticleContainer(containerElement: Element): ParticleContainerData {
  const attributes = elementAttributes(containerElement);
  const id = readRequiredString(attributes, 'id', 'PARTICLECONTAINER');
  
  const keyframes = childElements(containerElement, 'KEYFRAME').map(elementToParticleContainerKeyframe);
  const particles = childElements(containerElement, 'PARTICLE').map(elementToParticle);

  if (keyframes.length === 0) {
    throw new Error(`PARTICLECONTAINER ${id} 至少需要 1 个 KEYFRAME`);
  }

  return { type: 'particleContainer', id, keyframes, particles };
}

function elementToParticle(particleElement: Element): ParticleData {
  const attributes = elementAttributes(particleElement);
  const id = readRequiredString(attributes, 'id', 'PARTICLE');
  const keyframes = childElements(particleElement, 'KEYFRAME').map(elementToParticleKeyframe);

  if (keyframes.length === 0) {
    throw new Error(`PARTICLE ${id} 至少需要 1 个 KEYFRAME`);
  }

  return { type: 'particle', id, keyframes };
}

// ==========================================
// 关键帧 (KEYFRAME) 解析逻辑
// ==========================================

function elementToCameraKeyframe(kfElement: Element): CameraKeyframe {
  const attributes = elementAttributes(kfElement);
  return {
    frame: readRequiredInteger(attributes, 'frame', 'KEYFRAME'),
    x: readOptionalNumber(attributes.x, 'x'),
    y: readOptionalNumber(attributes.y, 'y'),
  };
}

function elementToSpriteKeyframe(kfElement: Element): SpriteKeyframe {
  const attributes = elementAttributes(kfElement);
  
  const atlas = readOptionalString(attributes, 'atlas');
  const atlasFrame = readOptionalString(attributes, 'atlasFrame');
  const image = readOptionalString(attributes, 'image');

  if (image && (atlas || atlasFrame)) {
    throw new Error('KEYFRAME 使用 image 时不能同时填写 atlas 或 atlasFrame');
  }

  return {
    frame: readRequiredInteger(attributes, 'frame', 'KEYFRAME'),
    atlas,
    atlasFrame,
    image,
    x: readOptionalNumber(attributes.x, 'x'),
    y: readOptionalNumber(attributes.y, 'y'),
    anchorX: readOptionalNumber(attributes.anchorX, 'anchorX'),
    anchorY: readOptionalNumber(attributes.anchorY, 'anchorY'),
    zIndex: readOptionalInteger(attributes.zIndex, 'zIndex'),
    scaleX: readOptionalNumber(attributes.scaleX, 'scaleX'),
    scaleY: readOptionalNumber(attributes.scaleY, 'scaleY'),
    rotation: readOptionalNumber(attributes.rotation, 'rotation'),
    alpha: readOptionalNumber(attributes.alpha, 'alpha'),
    visible: readOptionalBoolean(attributes.visible, 'visible'),
    blendMode: attributes.blendMode ? readBlendMode(attributes.blendMode) : undefined,
    tint: readOptionalColor(attributes.tint, 'tint'),
    active: readOptionalBoolean(attributes.active, 'active')
  };
}

function elementToParticleContainerKeyframe(kfElement: Element): ParticleContainerKeyframe {
  const attributes = elementAttributes(kfElement);
  return {
    frame: readRequiredInteger(attributes, 'frame', 'KEYFRAME'),
    atlas: readOptionalString(attributes, 'atlas'),
    zIndex: readOptionalInteger(attributes.zIndex, 'zIndex'),
    blendMode: attributes.blendMode ? readBlendMode(attributes.blendMode) : undefined,
    visible: readOptionalBoolean(attributes.visible, 'visible'),
    active: readOptionalBoolean(attributes.active, 'active')
  };
}

function elementToParticleKeyframe(kfElement: Element): ParticleKeyframe {
  const attributes = elementAttributes(kfElement);
  return {
    frame: readRequiredInteger(attributes, 'frame', 'KEYFRAME'),
    atlasFrame: readOptionalString(attributes, 'atlasFrame'),
    x: readOptionalNumber(attributes.x, 'x'),
    y: readOptionalNumber(attributes.y, 'y'),
    scaleX: readOptionalNumber(attributes.scaleX, 'scaleX'),
    scaleY: readOptionalNumber(attributes.scaleY, 'scaleY'),
    anchorX: readOptionalNumber(attributes.anchorX, 'anchorX'),
    anchorY: readOptionalNumber(attributes.anchorY, 'anchorY'),
    rotation: readOptionalNumber(attributes.rotation, 'rotation'),
    alpha: readOptionalNumber(attributes.alpha, 'alpha'),
    tint: readOptionalColor(attributes.tint, 'tint'),
    active: readOptionalBoolean(attributes.active, 'active')
  };
}

// ==========================================
// 工具函数 (基础数据读取)
// ==========================================

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

function readRequiredInteger(attributes: DslAttributes, key: string, nodeName: string) {
  const value = attributes[key];
  const parsed = readOptionalInteger(value, key);
  if (parsed === undefined) {
    throw new Error(`${nodeName} 缺少必填整数属性 ${key}`);
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

function buildAttributes(attributes: Record<string, string | number | boolean | undefined>) {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined) {
      continue;
    }
    parts.push(`${key}="${escapeXmlAttribute(String(value))}"`);
  }
  return parts.length ? ` ${parts.join(' ')}` : '';
}

function escapeXmlAttribute(raw: string) {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function serializeTint(value: string | number | undefined) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0 || value > 0xffffff) {
      throw new Error('tint 数值必须在 0x000000 - 0xFFFFFF 范围内');
    }
    return `0x${value.toString(16).padStart(6, '0')}`;
  }
  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^[\da-f]{6}$/i.test(normalized)) {
    throw new Error('tint 字符串必须是 0xRRGGBB 格式');
  }
  return `0x${normalized.toLowerCase()}`;
}