import { useState, useRef, useCallback, useEffect } from 'react';
import { PixiPhysicsCanvas, type PixiPhysicsRuntime } from '../components/PixiPhysicsCanvas';
import {
  GameEngine,
  EcsPhysicsSystem,
  EcsRenderSystem,
  EcsParticleSystem,
  EcsInputSystem,
  EcsSignalSystem,
  EcsGameObjectLifecycleSystem,
  EcsBehaviorSystem,
  EcsTimerSystem,
  EcsAnimationSystem,
} from '../game';
import type { World } from '../game/ecs/World';
import { toast } from '../components/Toast';
import { loadLastEcsXmlPath, saveLastEcsXmlPath } from '../store/ecsStore';

const FILE_SERVER_URL = 'http://127.0.0.1:8787';

export function GameECSPage() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('等待加载 XML 配置');
  const [world, setWorld] = useState<World | null>(null);
  const [xmlPath, setXmlPath] = useState<string | null>(null);
  const [canvasConfig, setCanvasConfig] = useState({
    width: 1280,
    height: 720,
    background: '#020817'
  });
  const runtimeRef = useRef<PixiPhysicsRuntime | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // 初始化时尝试从 store 加载上次的路径
  useEffect(() => {
    const init = async () => {
      const lastPath = await loadLastEcsXmlPath();
      if (lastPath) {
        setXmlPath(lastPath);
        setStatus(`已记住上次路径: ${lastPath}，点击“从磁盘加载”开始`);
      }
    };
    void init();
  }, []);

  const handleRuntimeReady = useCallback((runtime: PixiPhysicsRuntime) => {
    runtimeRef.current = runtime;
    if (xmlPath) {
      setStatus(`渲染引擎已就绪，可从磁盘加载: ${xmlPath}`);
    } else {
      setStatus('渲染引擎已就绪，请选择或加载 XML');
    }
  }, [xmlPath]);

  const handleRuntimeDestroy = useCallback(() => {
    runtimeRef.current = null;
    setWorld(null);
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }
  }, []);

  const clearCurrentScene = useCallback(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    // 切换 XML 前先清空 Pixi 渲染对象，避免旧场景残留
    runtime.processor.clear();
    setRunning(false);
    setWorld(null);
    lastTimeRef.current = 0;
  }, []);

  const pickFile = async () => {
    try {
      const response = await fetch(`${FILE_SERVER_URL}/file/pick`);
      const result = await response.json();
      if (result.ok && result.path) {
        setXmlPath(result.path);
        await saveLastEcsXmlPath(result.path);
        toast.success('已选择文件并保存路径');
        // 选择后自动尝试加载一次
        await loadFromDisk(result.path);
      }
    } catch (error) {
      console.error('Pick file failed:', error);
      toast.error('无法连接到本地服务器，请确保 server.py 已启动');
    }
  };

  const loadFromDisk = async (pathOverride?: string) => {
    const targetPath = pathOverride || xmlPath;
    if (!targetPath) {
      toast.error('请先选择 XML 文件');
      return;
    }

    if (!runtimeRef.current) {
      toast.error('渲染引擎尚未就绪');
      return;
    }

    setStatus(`正在从磁盘加载: ${targetPath}...`);
    try {
      const response = await fetch(`${FILE_SERVER_URL}/file/read?path=${encodeURIComponent(targetPath)}`);
      if (!response.ok) {
        throw new Error('读取文件失败，请检查路径是否正确');
      }

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error || '读取文件失败');
      }

      await initWorld(result.content);
      toast.success('场景已从磁盘同步更新');
    } catch (error) {
      console.error('从磁盘加载失败:', error);
      toast.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const loadExampleXml = async () => {
    if (!runtimeRef.current) {
      toast.error('渲染引擎尚未就绪');
      return;
    }

    try {
      const response = await fetch(`${FILE_SERVER_URL}/file/read?path=src/game/examples/bounce_scene.xml`);
      if (!response.ok) {
        throw new Error('无法从后端读取示例文件');
      }

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error || '读取文件失败');
      }

      await initWorld(result.content);
      toast.success('示例场景加载成功');
    } catch (error) {
      console.error('加载示例失败:', error);
      toast.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const initWorld = useCallback(async (xmlString: string) => {
    if (!runtimeRef.current) return;

    try {
      const processor = runtimeRef.current.processor;
      clearCurrentScene();

      // 1. 注册系统工厂
      GameEngine.registerSystem('PhysicsSystem', () => new EcsPhysicsSystem({ x: 0, y: 0 }, 4));
      GameEngine.registerSystem('RenderSystem', () => new EcsRenderSystem(processor));
      GameEngine.registerSystem('ParticleSystem', () => new EcsParticleSystem(processor));
      GameEngine.registerSystem('InputSystem', () => new EcsInputSystem());
      GameEngine.registerSystem('SignalSystem', () => new EcsSignalSystem());
      GameEngine.registerSystem('GameObjectLifecycleSystem', () => new EcsGameObjectLifecycleSystem());
      GameEngine.registerSystem('BehaviorSystem', () => new EcsBehaviorSystem());
      GameEngine.registerSystem('TimerSystem', () => new EcsTimerSystem());
      GameEngine.registerSystem('AnimationSystem', () => new EcsAnimationSystem());

      // 2. 创建世界
      const newWorld = await GameEngine.createWorldFromXml(xmlString);

      // 3. 更新画布配置 (如果 XML 中有定义)
      const canvas = newWorld.data?.canvas;
      if (canvas) {
        setCanvasConfig({
          width: canvas.width,
          height: canvas.height,
          background: canvas.background || '#020817'
        });
      }

      setWorld(newWorld);
      setRunning(true);
      setStatus('场景已同步，模拟运行中');
    } catch (error) {
      console.error('初始化 ECS 世界失败:', error);
      toast.error('XML 解析或初始化失败，请检查格式');
    }
  }, [clearCurrentScene]);

  useEffect(() => {
    const tick = (time: number) => {
      if (running && world) {
        const deltaTime = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 1 / 60;
        lastTimeRef.current = time;

        // 更新 ECS 世界
        world.update(deltaTime);
      } else {
        lastTimeRef.current = time;
      }
      animationRef.current = requestAnimationFrame(tick);
    };

    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [running, world]);

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">ECS Engine</p>
        <h1>ECS 驱动的游戏场景</h1>
        <p className="summary">
          基于 Entity-Component-System 架构，通过 XML 动态配置系统流水线和游戏对象。
        </p>
      </section>

      <section className="stage-card">
        <div
          className="pixi-host"
          style={{
            aspectRatio: `${canvasConfig.width} / ${canvasConfig.height}`,
            maxWidth: canvasConfig.width > 1200 ? '100%' : `${canvasConfig.width}px`,
            width: canvasConfig.width > canvasConfig.height ? '100%' : 'auto'
          }}
        >
          <PixiPhysicsCanvas
            key={`${canvasConfig.width}-${canvasConfig.height}-${canvasConfig.background}`}
            width={canvasConfig.width}
            height={canvasConfig.height}
            background={canvasConfig.background}
            onReady={handleRuntimeReady}
            onDestroy={handleRuntimeDestroy}
          />
        </div>
      </section>

      <section className="controls">
        <div className="control-group">
          <button className="primary" onClick={pickFile}>
            选择 XML 文件
          </button>

          <button
            className="record"
            onClick={() => void loadFromDisk()}
            disabled={!xmlPath}
            style={{ marginLeft: '12px' }}
          >
            从磁盘重新加载 (即时更新)
          </button>

          <button className="secondary" onClick={loadExampleXml} style={{ marginLeft: '12px' }}>
            加载内置示例
          </button>

          <button
            className="primary"
            onClick={() => setRunning(!running)}
            disabled={!world}
            style={{ marginLeft: '12px' }}
          >
            {running ? '暂停' : '继续'}
          </button>

          <button
            className="secondary"
            onClick={() => {
              clearCurrentScene();
              setStatus('已重置');
            }}
            disabled={!world}
            style={{ marginLeft: '12px' }}
          >
            重置场景
          </button>
        </div>

        {xmlPath && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--pale-blue)', opacity: 0.7 }}>
            当前路径: {xmlPath}
          </div>
        )}
      </section>

      <p className="status">{status}</p>
    </div>
  );
}
