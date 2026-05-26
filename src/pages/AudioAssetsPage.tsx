import { useEffect, useMemo, useState } from 'react';
import { assetRegistry } from '../assets/assetRegistry';
import type { AssetDefinition } from '../assets/assetRegistry';

export function AudioAssetsPage() {
  const [assets, setAssets] = useState<AssetDefinition[]>([]);
  const [status, setStatus] = useState('等待加载资源清单');
  const [loading, setLoading] = useState(false);

  const audioAssets = useMemo(
    () => assets.filter((asset) => asset.type === 'audio'),
    [assets],
  );

  const refreshAssets = async () => {
    setLoading(true);
    setStatus('正在请求后端刷新 public 资源清单...');
    try {
      const latestAssets = await assetRegistry.refreshManifest();
      setAssets(latestAssets);
      setStatus(`资源清单已刷新，共 ${latestAssets.length} 个资源`);
    } catch (error) {
      try {
        const fallbackAssets = await assetRegistry.loadManifest();
        setAssets(fallbackAssets);
        setStatus('后端刷新不可用，已读取现有 asset_manifest.json');
      } catch {
        setStatus(error instanceof Error ? error.message : '资源清单加载失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAssets();
  }, []);

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">Assets Management</p>
        <h1>音频资源库</h1>
        <p className="summary">
          管理和预览项目中的所有音频资产，包括背景音乐和音效。
        </p>
      </section>

      <section className="stage-card">
        <div className="asset-toolbar">
          <span className="asset-count">音频资源：{audioAssets.length}</span>
          <button className="primary" disabled={loading} onClick={refreshAssets}>
            {loading ? '刷新中...' : '刷新资源'}
          </button>
        </div>

        {audioAssets.length === 0 ? (
          <div className="empty-state">未发现音频资源，请确认 public 目录下存在音频文件。</div>
        ) : (
          <div className="asset-grid">
            {audioAssets.map(asset => (
              <div key={asset.id} className="asset-card">
                <div className="asset-preview">
                  <audio src={asset.url} controls preload="metadata" />
                </div>
                <div className="asset-card-body">
                  <h3 className="asset-title">{asset.id}</h3>
                  <p className="asset-meta">{asset.path ?? asset.url}</p>
                  <div className="asset-tags">
                    <span className="asset-tag">{asset.type}</span>
                    {(asset.tags ?? []).map(tag => (
                      <span key={tag} className="asset-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="status">{status}</p>
    </div>
  );
}
