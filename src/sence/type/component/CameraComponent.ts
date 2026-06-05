import type { IComponent } from '@sence/type/base/IComponent';

// 4.8 摄像机组件 (Camera) [cite: 23, 24]
export class CameraComponent implements IComponent {
    readonly type = 'Camera';
    x: number = 0;
    y: number = 0;
    z: number = 0;
    focus: number = 400;
}