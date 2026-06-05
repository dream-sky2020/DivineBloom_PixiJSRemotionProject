import type { GameObject } from '@sence/type/GameObject';
import type { EntityID } from '@sence/type/base/EntityID';

// 6. 预制体库数据结构 [cite: 36]
export class PrefabLibrary {
    // 存储以 Prefab ID 为键的 GameObject 模板
    prefabs: Map<string, GameObject> = new Map();

    // 实例化时，需要深度克隆 (Deep Clone) 模板上的所有组件数据
    instantiate(prefabId: string, newId: EntityID, newName?: string): GameObject {
        const template = this.prefabs.get(prefabId);
        if (!template) {
            throw new Error(`Prefab ${prefabId} not found`);
        }
        // ...执行深拷贝逻辑，生成新的 GameObject...
        const newInstance = {} as GameObject; // 占位逻辑
        return newInstance;
    }
}