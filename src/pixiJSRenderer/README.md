# PixiJS 高效渲染器架构 (PixiJSRenderer)

本目录包含了一套基于 **Command-Pattern (命令模式)** 和 **Reconciliation (差异对比)** 架构的 PixiJS 渲染方案，旨在解决 React 频繁更新导致的性能瓶颈以及 WebGL 显存管理问题。

## 核心组件

### 1. `PixiCanvas.tsx` (React 组件)
通用的 PixiJS 画布宿主组件，封装了复杂的生命周期管理。

*   **功能**：
    *   处理 PixiJS v8 的异步 `init()`。
    *   防止 React 严格模式下的初始化/销毁竞态。
    *   自动释放显存 (`app.destroy(true, { children: true, texture: true })`)。
*   **用法**：
    ```tsx
    <PixiCanvas
      width={1280}
      height={720}
      onInit={(app) => { /* 初始化逻辑 */ }}
      onDestroy={() => { /* 清理逻辑 */ }}
    />
    ```

### 2. `PixiFrameReconciler.ts` (逻辑类)
负责计算两帧之间的状态差异。

*   **功能**：
    *   维护双缓冲状态（当前帧 vs 下一帧）。
    *   通过 `reconcile()` 生成最小化的渲染命令集（Create/Update/Destroy）。
    *   支持对象排序和复杂的属性 Diff。
*   **用法**：
    ```ts
    reconciler.beginFrame();
    reconciler.setObject({ id: 'ball-1', kind: 'sprite', props: { x: 10, y: 20 } });
    const commands = reconciler.reconcile();
    ```

### 3. `PixiCommandProcessor.ts` (渲染执行器)
负责将抽象命令转换为具体的 PixiJS 操作。

*   **功能**：
    *   **对象池 (Pooling)**：自动回收和复用 `Sprite`、`Graphics` 等实例，减少 GC。
    *   **异步资源管理**：处理纹理加载的竞态条件。
    *   **颜色解析**：支持 CSS 颜色名、Hex、RGBA 等。
*   **用法**：
    ```ts
    const processor = new PixiCommandProcessor(app);
    processor.processCommands(commands);
    ```

## 渲染流程

1.  **构建状态**：在 React 的 `tick` 或 `useEffect` 中，使用 `reconciler.setObject` 定义下一帧的所有对象。
2.  **差异对比**：调用 `reconciler.reconcile()` 获取命令数组。
3.  **执行渲染**：将命令交给 `processor.processCommands()`。

## 最佳实践

1.  **对象 ID**：为每个渲染对象分配稳定的 `id`。如果 `id` 改变，渲染器会销毁旧对象并创建新对象。
2.  **显存释放**：始终通过 `PixiCanvas` 的 `onDestroy` 回调或直接调用 `processor.destroy()` 来确保资源释放。
3.  **纹理更新**：`PixiCommandProcessor` 已经处理了纹理加载的竞态，你可以放心地在短时间内多次更新纹理。

## 目录结构

*   `types.ts`: 定义了所有命令、属性和状态的接口。
*   `PixiCanvas.tsx`: React 宿主组件。
*   `PixiFrameReconciler.ts`: 差异对比算法。
*   `PixiCommandProcessor.ts`: 命令执行与对象池管理。
