import { assetRegistry } from './assetRegistry';

/**
 * 项目全局资产注册配置
 */

// 自动加载由 Python 脚本生成的资产清单
void assetRegistry.loadManifest();

export { assetRegistry };
