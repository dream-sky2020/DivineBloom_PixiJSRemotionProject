# ECS 管道模式梳理清单

本清单用于约束系统职责，避免“一个系统既做路由又做状态推进”的耦合扩散。

## 1) 固定系统顺序

推荐流水线（已在 `GameEngine` 中收敛）：

1. `InputSystem`
2. `SignalSystem`
3. `AnimationSystem`
4. `PhysicsSystem`
5. `ParticleSystem`
6. `GameObjectLifecycleSystem`
7. `RenderSystem`

## 2) 系统职责边界

- `InputSystem`：采样输入，发事件。
- `SignalSystem`：匹配规则，写动作请求。
- `AnimationSystem`：推进动画控制器，写动画轨道属性，发动画 `Key.Events`。
- `PhysicsSystem`：推进物理并同步回组件。
- `RenderSystem`：读取状态并输出渲染命令，不写业务状态。

## 3) 新功能接入前自检

- 这个功能是“事件路由”还是“状态推进”？只能选一个主职责系统。
- 是否新增了跨系统直接调用？如果有，优先改为事件或 action request。
- 是否能明确回答：事件在哪产生、在哪消费、在哪落状态？

## 4) 常见反模式

- 在 `SignalSystem` 里直接改 Transform / Sprite / RigidBody。
- 在 `RenderSystem` 里修改业务组件数据。
- 同一条业务链路同时在两个系统里写同一字段。
