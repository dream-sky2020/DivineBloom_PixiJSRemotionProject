# Game 文档总览

这个文档作为 `src/game` 目录下的统一文档入口，汇总当前核心规范文档。

## 文档目录

## 1) 自定义 GameObject (Behavior) 使用指南

- 文件：`src/game/doc/custom_gameobject_guide.md`
- 内容范围：
  - `GameObject` 接口定义
  - `Behavior` 组件用法
  - `GameObjectRegistry` 注册机制
  - 如何在代码中实现复杂动画和逻辑

直达链接：[`custom_gameobject_guide.md`](./custom_gameobject_guide.md)

## 2) 游戏世界初始化数据结构定义（ECS）

- 文件：`src/game/doc/world_data_structures.txt`
- 内容范围：
  - `World / EngineConfig / SystemPipeline`
  - `InputConfig / InputToSignalMap`
  - `GameObject` 与组件规范（Transform、Sprite、RigidBody、Collider、Graphic、Camera、ParticleEmitter、Behavior 等）
  - `SignalConfig`（`On` / `Emit` 编排）
  - `PrefabLibrary / Prefab / Instance` 扩展格式与跨文件约束

直达链接：[`world_data_structures.txt`](./world_data_structures.txt)

---

## 使用建议

- 复杂的逻辑和动画计算，请通过 `Behavior` 组件在代码中实现，参考 `custom_gameobject_guide.md`。
- 新增或调整世界 DSL/组件字段时，优先更新 `world_data_structures.txt`。
- 该入口文件仅做导航与范围说明，避免重复维护同一份规范文本。
