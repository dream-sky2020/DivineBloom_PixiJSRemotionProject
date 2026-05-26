# 战斗系统设计方案 (基于边狱巴士/Limbus Company)

为了实现类似《边狱巴士》的深度策略战斗系统，并支持通过 DSL (Domain Specific Language) 进行初始化和重复测试，建议采用以下设计方案。

## 1. 核心概念定义

### 1.1 角色 (Character)
- **属性**: 
  - **HP (生命值)**: 归零时角色战败。
  - **SP (精神值/理智值)**: 通常范围为 [-45, 45]。
  - **独特理智系统 (Unique Sanity System)**: 每个角色可拥有自定义的理智逻辑。例如：
    - *理智爆发*: 当 SP 达到最大值时，自动获得特定 Buff。
    - *理智沉沦*: SP 越低，特定属性加成越高，但负面硬币概率增加。
    - *资源转化*: 根据 SP 数值，每回合生成不同数量的特殊 Buff（如“下一次投掷必定正面”）。
  - **Balance (混乱阈值)**: 受到伤害达到阈值时进入混乱状态。
  - **Speed (速度范围)**: 决定行动顺序和拦截能力。
  - **技能上限 (Skill Slot Limit)**: 角色最多可拥有的技能槽位数量（随回合增加）。
  - **每回合抽取技能数量 (Draw Count)**: 每回合从技能池中补充到仪表盘的技能数。
- **抗性**: 斩击 (Slash)、穿刺 (Pierce)、打击 (Blunt) 以及 7 种罪恶属性的倍率。
- **技能槽**: 角色每回合拥有的行动点数。

### 1.2 技能与硬币 (Skill & Coin)
- **硬币概念**: 
  - **1:1 基础概率**: 硬币正反面基础概率各占 50%。
  - **理智修正**: SP 值会线性影响正面概率。例如：`正面概率 = 50% + (SP / 90)`。当 SP 为 45 时，正面概率为 100%；当 SP 为 -45 时，正面概率为 0%。
- **基础威力 (Base Power)**: 技能的起始点数。
- **硬币威力 (Coin Power)**: 每个硬币正面时增加/减少的威力。
- **硬币数量 (Coin Count)**: 技能包含的硬币总数。
- **拼点 (Clash)**: 双方技能威力对比，失败方损失一枚硬币并重新比拼，直到一方硬币耗尽。

### 1.3 特殊状态描述 (Status Effects)
- **必定正面 (Guaranteed Heads)**: 下一次投掷硬币时，无视 SP 概率，强制判定为正面。
- **必定反面 (Guaranteed Tails)**: 下一次投掷硬币时，强制判定为反面。
- **混乱 (Stagger)**: 无法行动，受到的所有伤害变为 2.0x (或更高)。

## 2. 战斗 DSL 语法设计

DSL 旨在简单明了地描述战斗的初始状态和过程。

### 2.1 初始化区块 `[INIT]`
用于定义参与战斗的所有角色及其初始状态。

```dsl
[INIT]
# 定义玩家方角色
<CHARACTER id="sinner_honglu" side="player">
  name: "鸿璐"
  hp: 160/160
  sp: [0, -45, 45]  # 当前SP, 最小值, 最大值
  balance: 120, 80, 40
  speed: [3, 6]
  skill_slots: 1/5   # 当前槽位/上限
  draw_count: 2      # 每回合抽牌数
  resistances: { slash: 1.0, pierce: 0.5, blunt: 2.0 }
  # 初始携带技能
  skills: ["cloud_cutter", "quick_suppression"]
</CHARACTER>

# 定义敌方角色
<CHARACTER id="abnormality_eye" side="enemy">
  name: "窥视之眼"
  hp: 500/500
  balance: 250
  speed: [1, 3]
  parts: [
    { id: "eye_lens", hp: 200, resistance: { slash: 2.0, pierce: 1.0, blunt: 1.0 } }
  ]
</CHARACTER>
```

### 2.2 回合区块 `[TURN X]`
用于描述特定回合的行动、环境变化或预设结果。

```dsl
[TURN 0]
# 设定初始状态，如某些角色预设的 SP 或 状态效果
<SET_STATE target="sinner_honglu" sp=45 />
<ADD_STATUS target="sinner_honglu" type="guaranteed_heads" count=1 />
<ADD_STATUS target="abnormality_eye" type="bleed" stack=5 count=2 />

[TURN 1]
# 描述指令下达
<ACTION actor="sinner_honglu" skill="cloud_cutter" target="abnormality_eye.eye_lens" />
<ACTION actor="abnormality_eye" skill="stare" target="sinner_honglu" />

# 预设拼点结果 (用于测试特定分支)
<CLASH_RESULT actor="sinner_honglu" winner=true coins_remaining=2 />
```

## 3. 战斗逻辑流

1.  **解析 DSL**: 将脚本转换为内存中的 `BattleState` 对象。
2.  **速度抽签**: 根据 `speed` 范围随机/设定每个技能槽的速度。
3.  **目标重定向**: 处理拦截 (Interception) 逻辑。
4.  **拼点阶段**:
    -   计算 `Base Power + (Heads Count * Coin Power)`。
    -   对比威力，失败方 `Coin Count - 1`。
    -   重复直到胜负已分。
5.  **伤害计算**:
    -   最终威力 * 抗性倍率 * 混乱倍率 * 暴击倍率。
    -   扣除 HP，检查是否触发 Balance (Stagger)。
6.  **状态更新**: 更新 SP、状态效果回合数等。

## 4. 扩展性考虑

-   **E.G.O 资源**: 在 `[INIT]` 中添加 `[RESOURCES]` 区块记录 7 种罪恶资源。
-   **被动技能**: 在角色定义中添加 `passives` 列表。
-   **动画关联**: 通过 `BattleAnimation` 类型将 DSL 中的动作与视觉表现关联。
