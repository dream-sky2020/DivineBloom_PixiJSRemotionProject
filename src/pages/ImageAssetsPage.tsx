import { useEffect, useMemo, useState } from 'react';
import { assetRegistry } from '../assets/assetRegistry';
import type { AssetDefinition } from '../assets/assetRegistry';
import { dialogs } from '../components/Dialogs';
import { ImageViewContent } from '../components/ImageViewContent';

export function ImageAssetsPage() {
  const [assets, setAssets] = useState<AssetDefinition[]>([]);
  const [status, setStatus] = useState('等待加载资源清单');
  const [loading, setLoading] = useState(false);

  const imageAssets = useMemo(
    () => assets.filter((asset) => asset.type === 'image' || asset.type === 'spritesheet'),
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

  const handleImageClick = (asset: AssetDefinition) => {
    if (asset.type === 'image') {
      dialogs.preview({
        title: `图片预览: ${asset.id}`,
        content: <ImageViewContent url={asset.url} title={asset.id} />,
        width: 1000,
      });
    }
  };

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">Assets Management</p>
        <h1>图像资源库</h1>
        <p className="summary">
          浏览和管理项目中的图像、纹理以及精灵图集。
        </p>
      </section>

      <section className="stage-card">
        <div className="asset-toolbar">
          <span className="asset-count">图片资源：{imageAssets.length}</span>
          <button className="primary" disabled={loading} onClick={refreshAssets}>
            {loading ? '刷新中...' : '刷新资源'}
          </button>
        </div>

        {imageAssets.length === 0 ? (
          <div className="empty-state">未发现图片资源，请确认 public 目录下存在图片文件。</div>
        ) : (
          <div className="asset-grid">
            {imageAssets.map(asset => (
              <div 
                key={asset.id} 
                className="asset-card" 
                onClick={() => handleImageClick(asset)}
                style={{ cursor: asset.type === 'image' ? 'pointer' : 'default' }}
              >
                <div className="asset-preview">
                  {asset.type === 'image' ? (
                    <img src={asset.url} alt={asset.id} loading="lazy" />
                  ) : (
                    <span className="asset-icon">SHEET</span>
                  )}
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
