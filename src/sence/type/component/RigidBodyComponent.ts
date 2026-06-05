import type { IComponent } from '@sence/type/base/IComponent';
import type { Vector2 } from '@sence/type/base/Vector';

// 4.3 刚体组件 (RigidBody) [cite: 16, 17, 18]
export class RigidBodyComponent implements IComponent {
    readonly type = 'RigidBody';
    mass: number = 1.0;
    bodyType: 'static' | 'dynamic' | 'kinematic' = 'dynamic';
    linearVelocity: Vector2 = { x: 0, y: 0 };
    angularVelocity: number = 0;
    restitution: number = 0.2;
    friction: number = 0.5;
    fixedRotation: boolean = false;
    bullet: boolean = false;
    sensor: boolean = false;
    gravityScale: number = 1.0;
    density: number = 1.0;
}