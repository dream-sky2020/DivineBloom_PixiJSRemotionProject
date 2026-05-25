/**
 * 通用资产注册表管理模块
 * 仅负责管理资产 ID 与 URL 的映射关系，不依赖于特定的渲染引擎。
 */

export interface AssetDefinition {
  id: string;
  url: string;
  type: string; // 如 'image', 'spritesheet', 'json', 'audio', 'video' 等
  group?: string; // 用于按需加载的分组
  path?: string; // 原始相对路径
  tags?: string[]; // 资产标签
  metadata?: Record<string, any>; // 额外的元数据
}

export class AssetRegistry {
  private registry: Map<string, AssetDefinition> = new Map();

  /**
   * 注册资产
   */
  public register(asset: AssetDefinition | AssetDefinition[]) {
    if (Array.isArray(asset)) {
      asset.forEach(a => this.registry.set(a.id, a));
    } else {
      this.registry.set(asset.id, asset);
    }
  }

  /**
   * 从 Manifest 加载资产
   */
  public async loadManifest(manifestUrl: string) {
    try {
      const response = await fetch(manifestUrl);
      const manifest: AssetDefinition[] = await response.json();
      this.register(manifest);
      console.log(`AssetRegistry: Loaded ${manifest.length} assets from ${manifestUrl}`);
    } catch (error) {
      console.error('AssetRegistry: Failed to load manifest:', error);
    }
  }

  /**
   * 获取资产 URL
   * 如果传入的是已注册的 ID，则返回对应的 URL；否则原样返回（支持直接传入 URL）
   */
  public getUrl(idOrUrl: string): string {
    return this.registry.get(idOrUrl)?.url || idOrUrl;
  }

  /**
   * 获取资产定义
   */
  public getDefinition(id: string): AssetDefinition | undefined {
    return this.registry.get(id);
  }

  /**
   * 获取特定分组的所有资产
   */
  public getGroup(group: string): AssetDefinition[] {
    return Array.from(this.registry.values()).filter(a => a.group === group);
  }

  /**
   * 获取所有已注册的资产
   */
  public getAll(): AssetDefinition[] {
    return Array.from(this.registry.values());
  }
}

// 导出一个全局单例
export const assetRegistry = new AssetRegistry();
