import { EngineConfig } from '@sence/type/EngineConfig';
import { PrefabLibrary } from '@sence/type/PrefabLibrary';
import { GameObject } from '@sence/type/GameObject';
import type { CanvasConfig } from '@sence/type/base/CanvasConfig';
import type { EntityID } from '@sence/type/base/EntityID';
import type { ISystem } from '@sence/type/base/ISystem';

export class GameWorld {
    // 1. 顶层容器 
    engineConfig: EngineConfig = new EngineConfig();
    canvasConfig: CanvasConfig = { width: 1920, height: 1080, background: '#020817' }; // [cite: 35, 36]
    prefabLibrary: PrefabLibrary = new PrefabLibrary(); // [cite: 36]
    
    // 运行时的实体集合
    entities: Map<EntityID, GameObject> = new Map();
    
    // 注册的系统列表
    systems: ISystem[] = [];
}
