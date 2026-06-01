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
  CanvasComponent,
  WorldData,
  EngineConfig,
  SystemConfig
} from '../types';

export class XmlParser {
  static parseWorld(xmlString: string): WorldData {
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

    // Parse GameObjects
    const entities: Entity[] = [];
    const gameObjectElements = worldElement.getElementsByTagName('GameObject');

    for (let i = 0; i < gameObjectElements.length; i++) {
      const el = gameObjectElements[i];
      const id = el.getAttribute('id') || `entity_${i}`;
      const name = el.getAttribute('name') || undefined;
      
      const entity: Entity = {
        id,
        name,
        components: new Map()
      };

      // Parse components
      for (let j = 0; j < el.children.length; j++) {
        const child = el.children[j];
        const component = this.parseComponent(child);
        if (component) {
          entity.components.set(component.type, component);
        }
      }

      entities.push(entity);
    }

    return { config, canvas, entities };
  }

  private static parseCanvas(worldEl: Element): CanvasComponent | undefined {
    const canvasEl = worldEl.getElementsByTagName('Canvas')[0];
    if (!canvasEl) return undefined;

    return {
      type: 'Canvas',
      name: canvasEl.getAttribute('name') || 'Untitled',
      width: parseFloat(canvasEl.getAttribute('width') || '1920'),
      height: parseFloat(canvasEl.getAttribute('height') || '1080'),
      background: canvasEl.getAttribute('background') || undefined,
    };
  }

  private static parseEngineConfig(worldEl: Element): EngineConfig {
    const configEl = worldEl.getElementsByTagName('EngineConfig')[0];
    const systems: SystemConfig[] = [];

    if (configEl) {
      const pipelineEl = configEl.getElementsByTagName('SystemPipeline')[0];
      if (pipelineEl) {
        const systemEls = pipelineEl.getElementsByTagName('System');
        for (let i = 0; i < systemEls.length; i++) {
          const el = systemEls[i];
          systems.push({
            name: el.getAttribute('name') || '',
            enabled: el.getAttribute('enabled') !== 'false'
          });
        }
      }
    }

    return { systems };
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
    const rotStr = el.getAttribute('rotation') || '0';
    const scaleStr = el.getAttribute('scale') || '1, 1, 1';

    const [px, py, pz] = posStr.split(',').map(s => parseFloat(s.trim()) || 0);
    const [sx, sy, sz] = scaleStr.split(',').map(s => parseFloat(s.trim()) || 1);

    return {
      type: 'Transform',
      position: { x: px, y: py, z: pz || 0 },
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

    return {
      type: 'RigidBody',
      mass: parseFloat(el.getAttribute('mass') || '1.0'),
      bodyType: (el.getAttribute('type') as any) || 'dynamic',
      linearVelocity: { x: vx, y: vy },
      angularVelocity: parseFloat(el.getAttribute('angularVelocity') || '0'),
      fixedRotation: el.getAttribute('fixedRotation') === 'true',
      bullet: el.getAttribute('bullet') === 'true',
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
}
