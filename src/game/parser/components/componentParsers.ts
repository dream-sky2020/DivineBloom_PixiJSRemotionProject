import type {
  AnyComponent,
  AnimationComponent,
  BehaviorComponent,
  BoxColliderComponent,
  CameraComponent,
  CircleColliderComponent,
  GameObjectControllerActionName,
  GameObjectControllerComponent,
  GraphicComponent,
  ParticleEmitterComponent,
  PolygonColliderComponent,
  RigidBodyComponent,
  SignalConfigComponent,
  SpriteComponent,
  TimerComponent,
  TransformComponent,
} from '../../types';
import { createGameObjectControllerActionRequestState } from '../../modules/lifecycle/GameObjectController';
import { sendDebugCommand } from '../../../debug/DebugLogger';
import { parseLoosePrimitive } from '../utils/primitive';
import { getDirectChildByTag, getDirectChildren } from '../xml/XmlDom';

interface ComponentParserContext {
  interfaceEl?: Element;
}

type ComponentParser = (el: Element, context: ComponentParserContext) => AnyComponent | null;

const componentParsers: Record<string, ComponentParser> = {
  Transform: (el) => parseTransform(el),
  Sprite: (el) => parseSprite(el),
  RigidBody: (el) => parseRigidBody(el),
  BoxCollider: (el) => parseBoxCollider(el),
  CircleCollider: (el) => parseCircleCollider(el),
  PolygonCollider: (el) => parsePolygonCollider(el),
  Graphic: (el) => parseGraphic(el),
  Camera: (el) => parseCamera(el),
  ParticleEmitter: (el) => parseParticleEmitter(el),
  GameObjectController: (el) => parseGameObjectController(el),
  SignalConfig: (el, context) => parseSignalConfig(el, context.interfaceEl),
  Behavior: (el) => parseBehavior(el),
  Timer: (el) => parseTimer(el),
  Animation: (el) => parseAnimation(el),
};

export function parseComponentByRegistry(
  el: Element,
  context: ComponentParserContext = {},
): AnyComponent | null {
  const parser = componentParsers[el.tagName];
  if (!parser) {
    sendDebugCommand({
      level: 'WARN',
      source: 'XmlParser:component',
      message: `Unknown component type: ${el.tagName}`,
    });
    return null;
  }
  try {
    return parser(el, context);
  } catch (error) {
    const attrs: Record<string, string> = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes.item(i);
      if (!attr) continue;
      attrs[attr.name] = attr.value;
    }
    sendDebugCommand({
      level: 'ERROR',
      source: 'XmlParser:component',
      message: 'parse failed',
      detail: {
        tag: el.tagName,
        attrs,
        hasInterfaceEl: Boolean(context.interfaceEl),
        error: error instanceof Error ? error.message : String(error),
      },
    });
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[XmlParser:component:${el.tagName}] ${message}`);
  }
}

function parseCircleCollider(el: Element): CircleColliderComponent {
  return {
    type: 'CircleCollider',
    radius: parseFloat(el.getAttribute('radius') || '0'),
    offset: {
      x: parseFloat(el.getAttribute('offsetX') || '0'),
      y: parseFloat(el.getAttribute('offsetY') || '0'),
    },
  };
}

function parsePolygonCollider(el: Element): PolygonColliderComponent {
  const pointsStr = el.getAttribute('points') || '';
  const points = pointsStr.split(' ').map((point) => {
    const [x, y] = point.split(',').map((value) => parseFloat(value.trim()));
    return { x, y };
  });
  return {
    type: 'PolygonCollider',
    points,
  };
}

function parseGraphic(el: Element): GraphicComponent {
  const kind = el.getAttribute('kind') as any;
  const fillColor = el.getAttribute('fillColor');
  const fillAlpha = el.getAttribute('fillAlpha');
  const alpha = el.getAttribute('alpha');
  const strokeColor = el.getAttribute('strokeColor');
  const strokeWidth = el.getAttribute('strokeWidth');
  const strokeAlpha = el.getAttribute('strokeAlpha');

  const graphic: GraphicComponent = {
    type: 'Graphic',
    kind,
    fill: fillColor ? { color: fillColor, alpha: parseFloat(fillAlpha || '1') } : undefined,
    stroke: strokeColor
      ? { color: strokeColor, width: parseFloat(strokeWidth || '1'), alpha: parseFloat(strokeAlpha || '1') }
      : undefined,
    alpha: alpha ? parseFloat(alpha) : undefined,
    width: parseFloat(el.getAttribute('width') || '0') || undefined,
    height: parseFloat(el.getAttribute('height') || '0') || undefined,
    radius: parseFloat(el.getAttribute('radius') || '0') || undefined,
  };

  const anchorStr = el.getAttribute('anchor');
  if (anchorStr) {
    const [ax, ay] = anchorStr.split(',').map((value) => parseFloat(value.trim()));
    if (Number.isFinite(ax) || Number.isFinite(ay)) {
      graphic.anchor = {
        x: Number.isFinite(ax) ? ax : 0,
        y: Number.isFinite(ay) ? ay : 0,
      };
    }
  }

  const pointsStr = el.getAttribute('points');
  if (pointsStr) {
    graphic.points = pointsStr.split(' ').map((point) => {
      const [x, y] = point.split(',').map((value) => parseFloat(value.trim()));
      return { x, y };
    });
  }

  return graphic;
}

function parseTransform(el: Element): TransformComponent {
  const posStr = el.getAttribute('position') || '0, 0, 0';
  const parent = el.getAttribute('parent') || undefined;
  const rotStr = el.getAttribute('rotation') || '0';
  const scaleStr = el.getAttribute('scale') || '1, 1, 1';

  const [px, py, pz] = posStr.split(',').map((value) => parseFloat(value.trim()) || 0);
  const [sx, sy, sz] = scaleStr.split(',').map((value) => parseFloat(value.trim()) || 1);

  return {
    type: 'Transform',
    position: { x: px, y: py, z: pz || 0 },
    parent,
    rotation: (parseFloat(rotStr) || 0) * (Math.PI / 180),
    scale: { x: sx, y: sy, z: sz || 1 },
  };
}

function parseSprite(el: Element): SpriteComponent {
  const texturePath = el.getAttribute('texture') || '';
  const anchorStr = el.getAttribute('anchor') || '0.5, 0.5';
  const [ax, ay] = anchorStr.split(',').map((value) => parseFloat(value.trim()) || 0.5);
  const tintStr = el.getAttribute('tint') || '0xffffff';

  return {
    type: 'Sprite',
    texture: { kind: 'image', image: texturePath },
    anchor: { x: ax, y: ay },
    alpha: parseFloat(el.getAttribute('alpha') || '1'),
    visible: el.getAttribute('visible') !== 'false',
    blendMode: (el.getAttribute('blendMode') as any) || 'normal',
    tint: parseInt(tintStr.startsWith('0x') ? tintStr : `0x${tintStr.replace('#', '')}`, 16),
    layer: parseInt(el.getAttribute('layer') || '0', 10),
  };
}

function parseRigidBody(el: Element): RigidBodyComponent {
  const velStr = el.getAttribute('linearVelocity') || '0, 0';
  const [vx, vy] = velStr.split(',').map((value) => parseFloat(value.trim()) || 0);
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
    density: parseFloat(el.getAttribute('density') || '1.0'),
  };
}

function parseBoxCollider(el: Element): BoxColliderComponent {
  return {
    type: 'BoxCollider',
    width: parseFloat(el.getAttribute('width') || '0'),
    height: parseFloat(el.getAttribute('height') || '0'),
    offset: {
      x: parseFloat(el.getAttribute('offsetX') || '0'),
      y: parseFloat(el.getAttribute('offsetY') || '0'),
    },
  };
}

function parseCamera(el: Element): CameraComponent {
  return {
    type: 'Camera',
    x: parseFloat(el.getAttribute('x') || '0'),
    y: parseFloat(el.getAttribute('y') || '0'),
    z: parseFloat(el.getAttribute('z') || '0'),
    focus: parseFloat(el.getAttribute('focus') || '400'),
  };
}

function parseParticleEmitter(el: Element): ParticleEmitterComponent {
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

function parseGameObjectController(el: Element): GameObjectControllerComponent {
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

function parseSignalConfig(el: Element, interfaceEl?: Element): SignalConfigComponent {
  const rules: SignalConfigComponent['rules'] = [];
  const interfaces: SignalConfigComponent['interfaces'] = [];

  for (const childEl of getDirectChildren(el)) {
    const whenEl = getDirectChildByTag(childEl, 'When');
    const argsEl = getDirectChildByTag(childEl, 'Args');
    const args: Record<string, string | number | boolean> = {};
    if (argsEl) {
      for (let i = 0; i < argsEl.attributes.length; i++) {
        const attr = argsEl.attributes.item(i);
        if (!attr) continue;
        args[attr.name] = parseLoosePrimitive(attr.value);
      }
      for (const setEl of getDirectChildren(argsEl)) {
        if (setEl.tagName !== 'Set') continue;
        const key = setEl.getAttribute('key');
        const valueAttr = setEl.getAttribute('value');
        const fromAttr = setEl.getAttribute('from');
        if (key) {
          if (fromAttr) {
            args[key] =
              fromAttr.startsWith('payload.') || fromAttr.startsWith('self.') || fromAttr.startsWith('ctx.')
                ? fromAttr
                : `payload.${fromAttr}`;
          } else if (valueAttr !== null) {
            args[key] = parseLoosePrimitive(valueAttr);
          }
        }
      }
    }

    if (childEl.tagName === 'On') {
      const event = (childEl.getAttribute('event') || '').trim();
      const target = (childEl.getAttribute('target') || '').trim();
      const action = (childEl.getAttribute('action') || '').trim();
      const emit = (childEl.getAttribute('emit') || '').trim();

      if (!event) continue;
      if (!target && !action && !emit) continue;

      rules.push({
        kind: 'action',
        event,
        target: target || undefined,
        action: action || undefined,
        emit: emit || undefined,
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

  if (interfaceEl) {
    for (const child of getDirectChildren(interfaceEl)) {
      if (child.tagName !== 'Signal') continue;
      const name = child.getAttribute('name') || '';
      const internal = child.getAttribute('internal') || '';
      const direction = (child.getAttribute('direction') || 'out') as 'in' | 'out';
      if (name && internal) {
        interfaces.push({ name, internal, direction });
      }
    }
  }

  rules.sort((left, right) => right.priority - left.priority);
  return {
    type: 'SignalConfig',
    rules,
    interfaces: interfaces.length > 0 ? interfaces : undefined,
  };
}

function parseBehavior(el: Element): BehaviorComponent {
  const behaviorType = (el.getAttribute('type') || '').trim();
  const params: Record<string, any> = {};

  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes.item(i);
    if (attr && attr.name !== 'type') {
      params[attr.name] = parseLoosePrimitive(attr.value);
    }
  }

  for (const child of getDirectChildren(el)) {
    const key = child.tagName;
    const value = child.textContent?.trim();
    if (value !== undefined) {
      params[key] = parseLoosePrimitive(value);
    }
  }

  return {
    type: 'Behavior',
    behaviorType,
    params,
  };
}

function parseTimer(el: Element): TimerComponent {
  return {
    type: 'Timer',
    time: parseFloat(el.getAttribute('time') || '0'),
    duration: parseFloat(el.getAttribute('duration') || '1'),
    loop: el.getAttribute('loop') === 'true',
    active: el.getAttribute('active') !== 'false',
    onCompleteSignal: el.getAttribute('onCompleteSignal') || undefined,
  };
}

function parseAnimation(el: Element): AnimationComponent {
  const labels: any[] = [];
  const defaultLabel = el.getAttribute('defaultLabel') || undefined;

  for (const labelEl of getDirectChildren(el)) {
    if (labelEl.tagName !== 'Label') continue;
    const tracks: any[] = [];
    for (const trackEl of getDirectChildren(labelEl)) {
      if (trackEl.tagName !== 'Track') continue;
      const keyframes: any[] = [];
      for (const keyEl of getDirectChildren(trackEl)) {
        if (keyEl.tagName === 'Key') {
          keyframes.push({
            frame: parseFloat(keyEl.getAttribute('frame') || '0'),
            value: parseLoosePrimitive(keyEl.getAttribute('value') || '0'),
            easing: keyEl.getAttribute('easing') || undefined,
          });
        }
      }
      keyframes.sort((a, b) => a.frame - b.frame);

      tracks.push({
        property: trackEl.getAttribute('prop') || '',
        interpolation: (trackEl.getAttribute('interpolation') || 'hold') as any,
        valueMode: (trackEl.getAttribute('valueMode') || 'absolute') as any,
        keyframes,
      });
    }

    labels.push({
      name: labelEl.getAttribute('name') || 'default',
      duration: parseFloat(labelEl.getAttribute('duration') || '1'),
      loop: labelEl.getAttribute('loop') !== 'false',
      speed: parseFloat(labelEl.getAttribute('speed') || '1.0'),
      tracks,
    });
  }

  return {
    type: 'Animation',
    labels,
    activeLabel: defaultLabel || (labels.length > 0 ? labels[0].name : undefined),
    currentFrame: 0,
    defaultLabel,
  };
}

function parseAnchor(anchorStr: string): { x: number; y: number } {
  const [x, y] = anchorStr.split(',').map((value) => parseFloat(value.trim()));
  return {
    x: Number.isFinite(x) ? x : 0.5,
    y: Number.isFinite(y) ? y : 0.5,
  };
}

function isGameObjectControllerActionName(value: string): value is GameObjectControllerActionName {
  return value === 'destroy';
}

function isRigidBodyEmitName(value: string): value is 'sensor.enter' | 'sensor.stay' | 'sensor.exit' {
  return value === 'sensor.enter' || value === 'sensor.stay' || value === 'sensor.exit';
}
