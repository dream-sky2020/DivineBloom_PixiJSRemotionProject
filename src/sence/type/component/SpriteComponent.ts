import type { IComponent } from '@sence/type/base/IComponent';
import type { Vector2 } from '@sence/type/base/Vector';

// 4.2 精灵组件 (Sprite) [cite: 14, 15, 16]
export class SpriteComponent implements IComponent {
    readonly type = 'Sprite';
    texture!: string; // 必填
    layer: number = 0;
    anchor: Vector2 = { x: 0.5, y: 0.5 };
    alpha: number = 1.0;
    visible: boolean = true;
    tint: string | number = 0xffffff;
}