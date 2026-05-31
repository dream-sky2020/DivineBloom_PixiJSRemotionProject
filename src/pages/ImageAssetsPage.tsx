import { useEffect, useMemo, useState } from 'react';
import { assetRegistry } from '../assets/assetRegistry';
import type { AssetDefinition } from '../assets/assetRegistry';
import { dialogs } from '../components/Dialogs';
import { ImageViewContent } from '../components/ImageViewContent';
import { toast } from '../components/Toast';

export function ImageAssetsPage() {
  const [assets, setAssets] = useState<AssetDefinition[]>([]);
  const [status, setStatus] = useState('等待加载资源清单');
  const [loading, setLoading] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [batchScale, setBatchScale] = useState('');
  const [batchAnchorX, setBatchAnchorX] = useState('');
  const [batchAnchorY, setBatchAnchorY] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);

  const imageAssets = useMemo(
    () => assets.filter((asset) => asset.type === 'image' || asset.type === 'spritesheet'),
    [assets],
  );
  const selectablePaths = useMemo(
    () => imageAssets.map((asset) => asset.path).filter((path): path is string => Boolean(path)),
    [imageAssets],
  );
  const selectedCount = selectedPaths.length;

  const refreshAssets = async () => {
    setLoading(true);
    setStatus('正在请求后端刷新 public 资源清单...');
    try {
      const latestAssets = await assetRegistry.refreshManifest();
      setAssets(latestAssets);
      const latestImagePaths = new Set(
        latestAssets
          .filter((asset) => asset.type === 'image' || asset.type === 'spritesheet')
          .map((asset) => asset.path)
          .filter((path): path is string => Boolean(path)),
      );
      setSelectedPaths((previous) => previous.filter((path) => latestImagePaths.has(path)));
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

  const updateSingleAssetDefaults = async (
    path: string,
    next: { defaultScale: number; defaultAnchorX: number; defaultAnchorY: number },
  ) => {
    const response = await fetch('http://127.0.0.1:8787/asset/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        defaultScale: next.defaultScale,
        defaultAnchorX: next.defaultAnchorX,
        defaultAnchorY: next.defaultAnchorY,
      }),
    });

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
    };
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? '保存默认参数失败');
    }
  };

  const toggleSelect = (path: string) => {
    setSelectedPaths((previous) =>
      previous.includes(path) ? previous.filter((item) => item !== path) : [...previous, path],
    );
  };

  const selectAll = () => {
    setSelectedPaths(selectablePaths);
  };

  const clearSelection = () => {
    setSelectedPaths([]);
  };

  const applyBatchDefaults = async () => {
    if (selectedPaths.length === 0) {
      toast.warning('请先选择至少一张图片');
      return;
    }

    const hasScale = batchScale.trim() !== '';
    const hasAnchorX = batchAnchorX.trim() !== '';
    const hasAnchorY = batchAnchorY.trim() !== '';
    if (!hasScale && !hasAnchorX && !hasAnchorY) {
      toast.warning('请至少填写一个批量参数');
      return;
    }

    const updates = selectedPaths.map((path) => {
      const payload: Record<string, string | number> = { path };
      if (hasScale) {
        const value = Number(batchScale);
        if (!Number.isFinite(value) || value <= 0) {
          throw new Error('默认缩放必须是大于 0 的数字');
        }
        payload.defaultScale = value;
      }
      if (hasAnchorX) {
        const value = Number(batchAnchorX);
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          throw new Error('Anchor X 必须在 0 到 1 之间');
        }
        payload.defaultAnchorX = value;
      }
      if (hasAnchorY) {
        const value = Number(batchAnchorY);
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          throw new Error('Anchor Y 必须在 0 到 1 之间');
        }
        payload.defaultAnchorY = value;
      }
      return payload;
    });

    setBatchSaving(true);
    try {
      const response = await fetch('http://127.0.0.1:8787/asset/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? '批量保存失败');
      }

      setAssets((previous) =>
        previous.map((asset) => {
          if (!asset.path || !selectedPaths.includes(asset.path)) {
            return asset;
          }
          return {
            ...asset,
            defaultScale: hasScale ? Number(batchScale) : asset.defaultScale,
            defaultAnchorX: hasAnchorX ? Number(batchAnchorX) : asset.defaultAnchorX,
            defaultAnchorY: hasAnchorY ? Number(batchAnchorY) : asset.defaultAnchorY,
          };
        }),
      );
      toast.success(`已批量更新 ${selectedPaths.length} 张图片参数`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '批量更新失败');
    } finally {
      setBatchSaving(false);
    }
  };

  const handleImageClick = (asset: AssetDefinition) => {
    if (asset.type === 'image') {
      dialogs.preview({
        title: `图片预览: ${asset.id}`,
        content: (
          <ImageViewContent
            url={asset.url}
            title={asset.id}
            initialScale={asset.defaultScale ?? 1}
            initialAnchorX={asset.defaultAnchorX ?? 0.5}
            initialAnchorY={asset.defaultAnchorY ?? 0.5}
            onSaveDefaults={async (next) => {
              if (!asset.path) {
                toast.error('当前资产缺少 path，无法保存默认参数');
                return;
              }

              await updateSingleAssetDefaults(asset.path, next);

              setAssets((previous) =>
                previous.map((item) =>
                  item.path === asset.path
                    ? {
                        ...item,
                        defaultScale: next.defaultScale,
                        defaultAnchorX: next.defaultAnchorX,
                        defaultAnchorY: next.defaultAnchorY,
                      }
                    : item,
                ),
              );
              toast.success(`已保存默认参数：${asset.id}`);
            }}
          />
        ),
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
          <span className="asset-count" style={{ marginLeft: '12px' }}>
            已选择：{selectedCount}
          </span>
          <button className="secondary" type="button" onClick={selectAll} disabled={selectablePaths.length === 0}>
            全选
          </button>
          <button className="secondary" type="button" onClick={clearSelection} disabled={selectedCount === 0}>
            清空选择
          </button>
          <button className="primary" disabled={loading} onClick={refreshAssets}>
            {loading ? '刷新中...' : '刷新资源'}
          </button>
        </div>
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            border: '1px solid var(--transparent-white-12)',
            borderRadius: '8px',
            backgroundColor: 'var(--transparent-white-05)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ color: 'var(--white-blue)' }}>批量参数</strong>
          <label>
            默认缩放
            <input
              value={batchScale}
              onChange={(event) => setBatchScale(event.target.value)}
              placeholder="留空表示不改"
              style={{ marginLeft: '8px', width: '120px' }}
            />
          </label>
          <label>
            Anchor X
            <input
              value={batchAnchorX}
              onChange={(event) => setBatchAnchorX(event.target.value)}
              placeholder="0~1"
              style={{ marginLeft: '8px', width: '90px' }}
            />
          </label>
          <label>
            Anchor Y
            <input
              value={batchAnchorY}
              onChange={(event) => setBatchAnchorY(event.target.value)}
              placeholder="0~1"
              style={{ marginLeft: '8px', width: '90px' }}
            />
          </label>
          <button className="primary" type="button" onClick={() => void applyBatchDefaults()} disabled={batchSaving}>
            {batchSaving ? '批量保存中...' : '应用到已选图片'}
          </button>
        </div>

        {imageAssets.length === 0 ? (
          <div className="empty-state">未发现图片资源，请确认 public 目录下存在图片文件。</div>
        ) : (
          <div className="asset-grid">
            {imageAssets.map((asset) => (
              <div
                key={asset.id}
                className="asset-card"
                onClick={() => handleImageClick(asset)}
                style={{
                  cursor: asset.type === 'image' ? 'pointer' : 'default',
                  borderColor:
                    asset.path && selectedPaths.includes(asset.path)
                      ? 'var(--cyan)'
                      : 'var(--transparent-white-12)',
                }}
              >
                <div className="asset-preview">
                  {asset.type === 'image' ? (
                    <img src={asset.url} alt={asset.id} loading="lazy" />
                  ) : (
                    <span className="asset-icon">SHEET</span>
                  )}
                </div>
                <div className="asset-card-body">
                  <label
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(asset.path && selectedPaths.includes(asset.path))}
                      disabled={!asset.path}
                      onChange={() => {
                        if (asset.path) {
                          toggleSelect(asset.path);
                        }
                      }}
                    />
                    选中用于批量修改
                  </label>
                  <h3 className="asset-title">{asset.id}</h3>
                  <p className="asset-meta">{asset.path ?? asset.url}</p>
                  <p className="asset-meta">
                    默认参数: scale {asset.defaultScale ?? 1}, anchor ({asset.defaultAnchorX ?? 0.5},{' '}
                    {asset.defaultAnchorY ?? 0.5})
                  </p>
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
