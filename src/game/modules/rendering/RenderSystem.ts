import { System } from '../../types';
import type { Entity, TransformComponent, SpriteComponent, GraphicComponent, CameraComponent } from '../../types';
import { PixiFrameReconciler } from '../../../pixiJSRenderer/PixiFrameReconciler';
import { PixiCommandProcessor } from '../../../pixiJSRenderer/PixiCommandProcessor';
import { createEntityMap, resolveWorldTransform, type TransformCache } from '../transform/transformHierarchy';

export class EcsRenderSystem extends System {
  private reconciler: PixiFrameReconciler;
  private processor: PixiCommandProcessor;

  constructor(processor: PixiCommandProcessor) {
    super();
    this.reconciler = new PixiFrameReconciler();
    this.processor = processor;
  }

  update(entities: Entity[], _deltaTime: number): void {
    this.reconciler.beginFrame();
    const entityMap = createEntityMap(entities);
    const transformCache: TransformCache = new Map();

    for (const entity of entities) {
      const camera = entity.components.get('Camera') as CameraComponent;
      if (camera) {
        this.reconciler.setObject({
          id: 'camera',
          kind: 'camera',
          props: {
            x: camera.x,
            y: camera.y,
            z: camera.z,
            focus: camera.focus
          }
        });
        break;
      }
    }

    for (const entity of entities) {
      const transform = entity.components.get('Transform') as TransformComponent;
      if (!transform) continue;
      const worldTransform = resolveWorldTransform(entity, entityMap, transformCache);
      if (!worldTransform) continue;

      const sprite = entity.components.get('Sprite') as SpriteComponent;
      const graphic = entity.components.get('Graphic') as GraphicComponent;

      if (sprite) {
        this.reconciler.setObject({
          id: entity.id.toString(),
          kind: 'sprite',
          props: {
            texture: sprite.texture,
            x: worldTransform.position.x,
            y: worldTransform.position.y,
            z: worldTransform.position.z,
            rotation: worldTransform.rotation,
            scaleX: worldTransform.scale.x,
            scaleY: worldTransform.scale.y,
            anchorX: sprite.anchor.x,
            anchorY: sprite.anchor.y,
            alpha: sprite.alpha,
            visible: sprite.visible,
            blendMode: sprite.blendMode,
            tint: sprite.tint,
            zIndex: sprite.layer
          }
        });
      } else if (graphic) {
        const anchorX = graphic.anchor?.x ?? 0.5;
        const anchorY = graphic.anchor?.y ?? 0.5;
        this.reconciler.setObject({
          id: entity.id.toString(),
          kind: graphic.kind as any,
          props: {
            x: worldTransform.position.x,
            y: worldTransform.position.y,
            rotation: worldTransform.rotation,
            scaleX: worldTransform.scale.x,
            scaleY: worldTransform.scale.y,
            alpha: graphic.alpha ?? 1,
            stroke: graphic.stroke,
            fill: graphic.fill,
            width: graphic.width,
            height: graphic.height,
            radius: graphic.radius,
            points: graphic.points,
            anchorX,
            anchorY
          } as any
        });
      }
    }

    const commands = this.reconciler.reconcile();
    this.processor.processCommands(commands);
  }

  getReconciler(): PixiFrameReconciler {
    return this.reconciler;
  }
}
