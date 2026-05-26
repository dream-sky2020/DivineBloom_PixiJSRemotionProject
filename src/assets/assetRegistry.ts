/**
 * 通用资产注册表管理模块
 * 统一负责资产清单刷新、加载，以及资产 ID 到 URL 的映射。
 */

export interface AssetDefinition {
  id: string;
  url: string;
  type: 'image' | 'spritesheet' | 'json' | 'audio' | 'video' | string;
  group?: string;
  path?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ManifestRefreshResponse {
  ok: boolean;
  assets?: AssetDefinition[];
  error?: string;
}

const ASSET_SERVER_URL = 'http://127.0.0.1:8787';
const MANIFEST_URL = '/asset_manifest.json';

export class AssetRegistry {
  private registry: Map<string, AssetDefinition> = new Map();

  /**
   * 注册资产
   */
  public register(asset: AssetDefinition | AssetDefinition[]) {
    if (Array.isArray(asset)) {
      asset.forEach((item) => this.registry.set(item.id, item));
    } else {
      this.registry.set(asset.id, asset);
    }
  }

  /**
   * 用新的资产清单替换当前注册表，避免刷新后残留已删除资产。
   */
  public replaceAll(assets: AssetDefinition[]) {
    this.registry.clear();
    this.register(assets);
  }

  /**
   * 从 Manifest 加载资产
   */
  public async loadManifest(manifestUrl = MANIFEST_URL) {
    const response = await fetch(withCacheBuster(manifestUrl));
    if (!response.ok) {
      throw new Error(`加载资源清单失败：${response.status}`);
    }

    const manifest = (await response.json()) as AssetDefinition[];
    this.replaceAll(manifest);
    return manifest;
  }

  /**
   * 请求后端重新扫描 public 目录并生成最新 Manifest。
   */
  public async refreshManifest() {
    const response = await fetch(`${ASSET_SERVER_URL}/manifest/refresh`, {
      method: 'POST',
    });
    const result = (await response.json()) as ManifestRefreshResponse;

    if (!response.ok || !result.ok) {
      throw new Error(result.error ?? '刷新资源清单失败');
    }

    if (result.assets) {
      this.replaceAll(result.assets);
      return result.assets;
    }

    return this.loadManifest();
  }

  /**
   * 获取资产 URL
   * 支持资产 ID、manifest path，以及 public 目录下的相对路径。
   */
  public getUrl(idOrUrl: string): string {
    const registeredAsset = this.registry.get(idOrUrl);
    if (registeredAsset) {
      return registeredAsset.url;
    }

    const normalizedPath = idOrUrl.replace(/^\/+/, '');
    const pathMatchedAsset = Array.from(this.registry.values()).find((asset) => {
      return asset.path === normalizedPath || asset.url === `/${normalizedPath}`;
    });

    return pathMatchedAsset?.url || normalizePublicUrl(idOrUrl);
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
    return Array.from(this.registry.values()).filter((asset) => asset.group === group);
  }

  /**
   * 获取所有已注册的资产
   */
  public getAll(): AssetDefinition[] {
    return Array.from(this.registry.values());
  }
}

function withCacheBuster(url: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
}

function normalizePublicUrl(url: string) {
  if (
    url.startsWith('/') ||
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  ) {
    return url;
  }

  return `/${url}`;
}

export const assetRegistry = new AssetRegistry();
