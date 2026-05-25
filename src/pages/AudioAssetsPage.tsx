export function AudioAssetsPage() {
  // 模拟数据
  const audioAssets = [
    { id: 'bgm-main', name: '主背景音乐', type: 'audio', tags: ['bgm', 'loop'] },
    { id: 'sfx-click', name: '点击音效', type: 'audio', tags: ['sfx', 'ui'] },
  ];

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {audioAssets.map(asset => (
            <div key={asset.id} style={{ 
              background: 'var(--dark-gray)', 
              padding: '1.25rem', 
              borderRadius: '16px',
              border: '1px solid var(--transparent-white-12)'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎵</div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--white-blue)' }}>{asset.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-blue)', marginBottom: '1rem' }}>ID: {asset.id}</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {asset.tags.map(tag => (
                  <span key={tag} style={{ 
                    fontSize: '0.75rem', 
                    padding: '0.2rem 0.6rem', 
                    background: 'var(--transparent-cyan-10)', 
                    color: 'var(--cyan)',
                    borderRadius: '20px'
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
              <button className="primary" style={{ width: '100%', marginTop: '1.25rem', padding: '0.6rem' }}>
                播放预览
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
