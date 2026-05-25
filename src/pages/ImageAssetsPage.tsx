export function ImageAssetsPage() {
  // 模拟数据
  const imageAssets = [
    { id: 'hero-sprite', name: '主角精灵图', type: 'spritesheet', tags: ['character', 'player'] },
    { id: 'bg-forest', name: '森林背景', type: 'image', tags: ['environment', 'background'] },
    { id: 'icon-sword', name: '剑图标', type: 'image', tags: ['item', 'ui'] },
  ];

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.5rem' }}>
          {imageAssets.map(asset => (
            <div key={asset.id} style={{ 
              background: 'var(--dark-gray)', 
              borderRadius: '16px',
              border: '1px solid var(--transparent-white-12)',
              overflow: 'hidden'
            }}>
              <div style={{ 
                height: '140px', 
                background: 'var(--deep-black-blue)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '2.5rem'
              }}>
                {asset.type === 'spritesheet' ? '🖼️' : '📷'}
              </div>
              <div style={{ padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.4rem 0', fontSize: '1rem', color: 'var(--white-blue)' }}>{asset.name}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-blue)', marginBottom: '0.8rem' }}>{asset.id}</p>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {asset.tags.map(tag => (
                    <span key={tag} style={{ 
                      fontSize: '0.7rem', 
                      padding: '0.15rem 0.5rem', 
                      background: 'var(--transparent-blue-30)', 
                      color: 'var(--blue)',
                      borderRadius: '20px'
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
