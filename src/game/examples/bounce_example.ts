import {
  GameEngine,
  registerDefaultSystems,
} from '../index';
import type { PixiCommandProcessor } from '../../pixiJSRenderer/PixiCommandProcessor';

/**
 * 这是一个如何使用 ECS 引擎初始化弹跳场景的示例
 * 
 * @param pixiProcessor PixiJS 的命令处理器实例
 * @param xmlString bounce_scene.xml 的内容
 */
export async function initBounceExample(pixiProcessor: PixiCommandProcessor, xmlString: string) {
  // 1. 注册系统工厂函数（名称需与 XML 中的 <System name="..." /> 匹配）
  registerDefaultSystems({
    processor: pixiProcessor,
    gravity: { x: 0, y: 0 },
    substeps: 4,
  });

  // 2. 从 XML 创建世界
  // 解析器会自动处理 EngineConfig (系统加载) 和 GameObject (实体创建)
  const world = await GameEngine.createWorldFromXml(xmlString);

  return world;
}
