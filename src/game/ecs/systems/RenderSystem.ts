import { System } from '../../types';
import type { Entity, TransformComponent, SpriteComponent, GraphicComponent, CameraComponent } from '../../types';
import { PixiFrameReconciler } from '../../../pixiJSRenderer/PixiFrameReconciler';
import { PixiCommandProcessor } from '../../../pixiJSRenderer/PixiCommandProcessor';

/**
 * 渲染系统 (ECS 桥接版)
 * 负责将 ECS 实体同步到 PixiJS 渲染引擎
 */
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

    // 处理相机 (单例模式，取第一个找到的相机)
    for (const entity of entities) {
      const camera = entity.components.get('Camera') as CameraComponent;
      if (camera) {
        this.reconciler.setObject({
          id: 'camera', // 相机在渲染器中通常是单例，使用固定 ID
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

      const sprite = entity.components.get('Sprite') as SpriteComponent;
      const graphic = entity.components.get('Graphic') as GraphicComponent;

      if (sprite) {
        this.reconciler.setObject({
          id: entity.id.toString(),
          kind: 'sprite',
          props: {
            texture: sprite.texture,
            x: transform.position.x,
            y: transform.position.y,
            z: transform.position.z,
            rotation: transform.rotation,
            scaleX: transform.scale.x,
            scaleY: transform.scale.y,
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
            x: transform.position.x,
            y: transform.position.y,
            rotation: transform.rotation,
            scaleX: transform.scale.x,
            scaleY: transform.scale.y,
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

    // 差异对比并执行命令
    const commands = this.reconciler.reconcile();
    this.processor.processCommands(commands);
  }

  getReconciler(): PixiFrameReconciler {
    return this.reconciler;
  }
}
