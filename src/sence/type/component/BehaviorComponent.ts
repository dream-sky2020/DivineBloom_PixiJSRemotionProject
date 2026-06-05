import type { IComponent } from '@sence/type/base/IComponent';

// 4.10 行为组件 (Behavior) [cite: 28, 29]
export class BehaviorComponent implements IComponent {
    readonly type = 'Behavior';
    behaviorType!: string; // 对应 type 属性，必填
    params: Record<string, any> = {}; // 存储 XML 中的其他属性和 <CustomData>
    
    // 引擎运行时可绑定的真实逻辑实例对象
    runtimeInstance?: any; 
}
