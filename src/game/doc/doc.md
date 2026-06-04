# Game 文档总览

这个文档作为 `src/game` 目录下的统一文档入口，汇总当前核心规范文档。

## 文档目录

## 1) 动画模块数据规范

- 文件：`src/game/doc/animation_module_spec.txt`
- 内容范围：
  - `Animations`（单实体动画资产）
  - `AnimationController`（单实体动画控制，含 layered 模式）
  - `StageScriptLibrary`（多角色舞台动画资产）
  - `Key.Events`（关键帧事件）
  - `StageDirectorController`（多导演运行时编排）
  - 解析约束、冲突规则、错误码、strict/loose 行为建议

直达链接：[`animation_module_spec.txt`](./doc/animation_module_spec.txt)

## 2) 游戏世界初始化数据结构定义（ECS）

- 文件：`src/game/doc/world_data_structures.txt`
- 内容范围：
  - `World / EngineConfig / SystemPipeline`
  - `EventBus / InputConfig / InputToSignalMap`
  - `GameObject` 与组件规范（Transform、Sprite、RigidBody、Collider、Graphic、Camera、ParticleEmitter 等）
  - `SignalConfig`（`On` / `Emit` 编排）
  - `PrefabLibrary / Prefab / Instance` 扩展格式与跨文件约束

直达链接：[`world_data_structures.txt`](./doc/world_data_structures.txt)

---

## 使用建议

- 新增或调整动画字段时，优先更新 `animation_module_spec.txt`。
- 新增或调整世界 DSL/组件字段时，优先更新 `world_data_structures.txt`。
- 该入口文件仅做导航与范围说明，避免重复维护同一份规范文本。
