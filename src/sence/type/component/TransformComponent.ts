import type { IComponent } from '@sence/type/base/IComponent';
import type { Vector3 } from '@sence/type/base/Vector';
import type { EntityID } from '@sence/type/base/EntityID';

// 4.1 变换组件 (Transform) [cite: 13, 14]
export class TransformComponent implements IComponent {
    readonly type = 'Transform';
    position: Vector3 = { x: 0, y: 0, z: 0 };
    parent?: EntityID; 
    rotation: number = 0; // 内部存储建议转换为弧度
    scale: Vector3 = { x: 1, y: 1, z: 1 };
}