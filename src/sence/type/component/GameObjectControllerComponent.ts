import type { IComponent } from '@sence/type/base/IComponent';

// 4.12 游戏对象控制组件 (GameObjectController) [cite: 30]
export class GameObjectControllerComponent implements IComponent {
    readonly type = 'GameObjectController';
    alive: boolean = true;
    destroyable: boolean = true;
    destroyDelayMs: number = 0;
    actions: string = 'destroy';
}
