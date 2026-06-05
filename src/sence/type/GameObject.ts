import type { IComponent } from '@sence/type/base/IComponent';
import type { EntityID } from '@sence/type/base/EntityID';

// 3. 游戏对象 [cite: 12, 13]
export class GameObject {
    id: EntityID;
    name?: string;
    
    // 使用组件类型名称作为键，方便快速检索，例如 components['Transform']
    components: Map<string, IComponent> = new Map();

    constructor(id: EntityID, name?: string) {
        this.id = id;
        this.name = name;
    }

    addComponent(component: IComponent) {
        this.components.set(component.type, component);
    }
    
    getComponent<T extends IComponent>(type: string): T | undefined {
        return this.components.get(type) as T;
    }
}

