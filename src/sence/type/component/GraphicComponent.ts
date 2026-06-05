import type { IComponent } from '@sence/type/base/IComponent';
import type { Vector2 } from '@sence/type/base/Vector';


// 4.7 矢量图形组件 (Graphic) [cite: 21, 22, 23]
export class GraphicComponent implements IComponent {
    readonly type = 'Graphic';
    kind!: 'circleGraphic' | 'rectangleGraphic' | 'polygonGraphic' | string; // 必填
    fillColor?: string;
    fillAlpha?: number;
    strokeColor?: string;
    strokeWidth?: number;
    
    // 特定形状必填属性
    radius?: number;
    width?: number;
    height?: number;
    points?: Vector2[];
}