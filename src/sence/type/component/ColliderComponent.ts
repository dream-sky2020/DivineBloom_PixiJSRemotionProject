import type { IComponent } from '@sence/type/base/IComponent';
import type { Vector2 } from '@sence/type/base/Vector';

// 4.4 盒碰撞体组件 (BoxCollider) [cite: 18, 19]
export class BoxColliderComponent implements IComponent {
    readonly type = 'BoxCollider';
    width!: number;  // 必填
    height!: number; // 必填
    offsetX: number = 0;
    offsetY: number = 0;
}

// 4.5 圆形碰撞体组件 (CircleCollider) [cite: 19, 20]
export class CircleColliderComponent implements IComponent {
    readonly type = 'CircleCollider';
    radius!: number; // 必填
    offsetX: number = 0;
    offsetY: number = 0;
}

// 4.6 多边形碰撞体组件 (PolygonCollider) [cite: 20, 21]
export class PolygonColliderComponent implements IComponent {
    readonly type = 'PolygonCollider';
    points!: Vector2[]; // 必填，解析空格分隔的坐标对
}