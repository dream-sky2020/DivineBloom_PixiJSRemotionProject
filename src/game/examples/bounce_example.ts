import {
  GameEngine,
  EcsPhysicsSystem,
  EcsRenderSystem,
  EcsParticleSystem,
  EcsAnimationSystem,
  EcsInputSystem,
  EcsSignalSystem,
  EcsGameObjectLifecycleSystem,
  EcsStageDirectorSystem,
} from '../index';
import type { PixiCommandProcessor } from '../../pixiJSRenderer/PixiCommandProcessor';

/**
 * 这是一个如何使用 ECS 引擎初始化弹跳场景的示例
 * 
 * @param pixiProcessor PixiJS 的命令处理器实例
 * @param xmlString bounce_scene.xml 的内容
 */
export async function initBounceExample(pixiProcessor: PixiCommandProcessor, xmlString: string) {
  // 1. 注册系统工厂函数
  // 这里的名称必须与 XML 中的 <System name="..." /> 匹配
  GameEngine.registerSystem('PhysicsSystem', () => new EcsPhysicsSystem({ x: 0, y: 0 }, 4));
  GameEngine.registerSystem('RenderSystem', () => new EcsRenderSystem(pixiProcessor));
  GameEngine.registerSystem('ParticleSystem', () => new EcsParticleSystem(pixiProcessor));
  GameEngine.registerSystem('AnimationSystem', () => new EcsAnimationSystem());
  GameEngine.registerSystem('InputSystem', () => new EcsInputSystem());
  GameEngine.registerSystem('SignalSystem', () => new EcsSignalSystem());
  GameEngine.registerSystem('GameObjectLifecycleSystem', () => new EcsGameObjectLifecycleSystem());
  GameEngine.registerSystem('StageDirectorSystem', () => new EcsStageDirectorSystem());

  // 2. 从 XML 创建世界
  // 解析器会自动处理 EngineConfig (系统加载) 和 GameObject (实体创建)
  const world = await GameEngine.createWorldFromXml(xmlString);

  return world;
}
