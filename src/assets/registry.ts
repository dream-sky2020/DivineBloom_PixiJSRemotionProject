import { assetRegistry } from '../utils/assetRegistry';

/**
 * 项目全局资产注册配置
 */

// 自动加载由 Python 脚本生成的资产清单
assetRegistry.loadManifest('/asset_manifest.json');

export { assetRegistry };
