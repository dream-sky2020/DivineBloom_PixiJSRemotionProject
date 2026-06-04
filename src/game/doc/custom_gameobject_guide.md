# 自定义 GameObject (Behavior) 使用指南

为了解决 ECS 系统在处理复杂动画和逻辑时 XML 过于臃肿的问题，我们引入了 `GameObject` 接口和 `Behavior` 组件。这允许你在代码中实现复杂的逻辑，同时保留 XML 快速加载和配置的优势。

## 1. 定义自定义 GameObject

在任何文件夹中创建一个实现 `GameObject` 接口的类：

```typescript
import { GameObject, Entity } from '../src/game/types';

export class MyCustomBoss implements GameObject {
  constructor(public entity: Entity, params: Record<string, any>) {
    console.log('Boss spawned with params:', params);
  }

  onAwake() {
    // 初始化逻辑
  }

  onUpdate(deltaTime: number) {
    // 复杂的动画计算逻辑，直接操作组件
    const transform = this.entity.components.get('Transform') as any;
    const sprite = this.entity.components.get('Sprite') as any;
    
    if (transform) {
      transform.position.y += Math.sin(Date.now() * 0.001) * 2;
    }
    
    if (sprite) {
      sprite.alpha = 0.5 + Math.sin(Date.now() * 0.002) * 0.5;
    }
  }

  onMessage?(message: string, payload: any) {
    // 处理自定义消息
  }

  onDestroy() {
    // 清理逻辑
  }
}
```

## 2. 注册自定义类型

在游戏启动时，将你的类注册到 `GameObjectRegistry`：

```typescript
import { GameObjectRegistry } from '../src/game/GameObjectRegistry';
import { MyCustomBoss } from './MyCustomBoss';

GameObjectRegistry.register('Boss', (entity, params) => new MyCustomBoss(entity, params));
```

## 3. 在 XML 中使用

在 XML 中，通过 `<Behavior>` 标签引用注册的类型：

```xml
<GameObject id="boss_1">
    <Transform position="100, 100, 0" />
    <Sprite texture="assets/boss.png" />
    <!-- 使用自定义行为 -->
    <Behavior type="Boss" health="1000" difficulty="hard">
        <CustomData>some extra info</CustomData>
    </Behavior>
</GameObject>
```

## 4. 优势

- **代码实现复杂逻辑**：不再需要在 XML 中编写复杂的动画轨迹或状态机。
- **直接操作组件**：通过 `this.entity.components` 直接获取并修改 `Transform`、`Sprite`、`RigidBody` 等组件，实现动态效果。
- **解耦**：具体的游戏逻辑可以放在 `src/game/logic` 或其他任何地方，ECS 只负责调度。
- **高性能**：原生代码计算比解析 XML 轨迹更快。
