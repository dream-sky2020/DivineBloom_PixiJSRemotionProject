import React, { useState, useEffect, useRef } from 'react';
// 如果你有外部引入的 toast 或其他组件，可以在这里保留
// import { toast } from '../components/Toast';

const SVG_SIZE = 300;
const HANDLE_RADIUS = 8;

const PRESETS: Record<string, [number, number, number, number]> = {
  'Ease': [0.25, 0.1, 0.25, 1.0],
  'Linear': [0.0, 0.0, 1.0, 1.0],
  'EaseInQuad': [0.55, 0.085, 0.68, 0.53],
  'EaseOutQuad': [0.25, 0.46, 0.45, 0.94],
  'EaseInOutQuad': [0.455, 0.03, 0.515, 0.955],
};

export function BezierEditorPage() {
  const [p1, setP1] = useState({ x: 0.25, y: 0.1 });
  const [p2, setP2] = useState({ x: 0.25, y: 1.0 });
  const [dragging, setDragging] = useState<'p1' | 'p2' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const bezierString = `cubic-bezier(${p1.x.toFixed(2)}, ${p1.y.toFixed(2)}, ${p2.x.toFixed(2)}, ${p2.y.toFixed(2)})`;

  // SVG 坐标系映射 (SVG 原点在左上角，贝塞尔原点在左下角)
  const toSvgX = (x: number) => x * SVG_SIZE;
  const toSvgY = (y: number) => (1 - y) * SVG_SIZE;

  // 处理拖拽逻辑
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      
      // 计算相对鼠标位置
      let x = (e.clientX - rect.left) / SVG_SIZE;
      let y = 1 - (e.clientY - rect.top) / SVG_SIZE;

      // 贝塞尔曲线的 X 轴必须限制在 [0, 1] 之间，Y 轴可以超出（实现弹性回弹效果）
      x = Math.max(0, Math.min(1, x));

      if (dragging === 'p1') setP1({ x, y });
      if (dragging === 'p2') setP2({ x, y });
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  const applyPreset = (presetName: string) => {
    const [x1, y1, x2, y2] = PRESETS[presetName];
    setP1({ x: x1, y: y1 });
    setP2({ x: x2, y: y2 });
  };

  const triggerAnimation = () => {
    setIsPlaying((prev) => !prev);
  };

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">Easing Editor</p>
        <h1>贝塞尔曲线调整与预览</h1>
        <p className="summary">
          手动拖拽控制点，或选择预设，实时预览缓动曲线动画效果并输出 CSS 代码。
        </p>
      </section>

      <div className="workspace-grid dsl-workspace-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* 左侧：可视化编辑区 */}
        <section className="stage-card workspace-panel dsl-preview-panel">
          <h2 className="panel-title">曲线编辑</h2>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <svg
              ref={svgRef}
              width={SVG_SIZE}
              height={SVG_SIZE}
              style={{ overflow: 'visible', cursor: dragging ? 'grabbing' : 'default', background: 'white', border: '1px solid #dee2e6' }}
            >
              {/* 背景网格线 */}
              <line x1="0" y1="0" x2={SVG_SIZE} y2="0" stroke="#eee" strokeWidth="2" />
              <line x1="0" y1={SVG_SIZE} x2={SVG_SIZE} y2={SVG_SIZE} stroke="#eee" strokeWidth="2" />
              <line x1="0" y1="0" x2="0" y2={SVG_SIZE} stroke="#eee" strokeWidth="2" />
              <line x1={SVG_SIZE} y1="0" x2={SVG_SIZE} y2={SVG_SIZE} stroke="#eee" strokeWidth="2" />

              {/* 连接控制点的辅助线 */}
              <line x1="0" y1={SVG_SIZE} x2={toSvgX(p1.x)} y2={toSvgY(p1.y)} stroke="#999" strokeWidth="2" strokeDasharray="4" />
              <line x1={SVG_SIZE} y1="0" x2={toSvgX(p2.x)} y2={toSvgY(p2.y)} stroke="#999" strokeWidth="2" strokeDasharray="4" />

              {/* 核心贝塞尔曲线 */}
              <path
                d={`M 0,${SVG_SIZE} C ${toSvgX(p1.x)},${toSvgY(p1.y)} ${toSvgX(p2.x)},${toSvgY(p2.y)} ${SVG_SIZE},0`}
                fill="none"
                stroke="var(--primary-color, #007acc)"
                strokeWidth="4"
              />

              {/* 控制点 P1 */}
              <circle
                cx={toSvgX(p1.x)}
                cy={toSvgY(p1.y)}
                r={HANDLE_RADIUS}
                fill="#ff4757"
                style={{ cursor: 'grab' }}
                onMouseDown={() => setDragging('p1')}
              />
              {/* 控制点 P2 */}
              <circle
                cx={toSvgX(p2.x)}
                cy={toSvgY(p2.y)}
                r={HANDLE_RADIUS}
                fill="#2ed573"
                style={{ cursor: 'grab' }}
                onMouseDown={() => setDragging('p2')}
              />
            </svg>
          </div>
        </section>

        {/* 右侧：代码输出与动画预览 */}
        <section className="stage-card workspace-panel">
          <h2 className="panel-title">动画预览与输出</h2>
          
          <div style={{ marginBottom: '24px' }}>
            <div 
              style={{ 
                background: '#e9ecef', 
                height: '60px', 
                borderRadius: '8px', 
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px'
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'var(--primary-color, #007acc)',
                  borderRadius: '6px',
                  position: 'absolute',
                  left: isPlaying ? 'calc(100% - 50px)' : '10px',
                  transition: `left 1s ${bezierString}`,
                }}
              />
            </div>
            <button className="primary" onClick={triggerAnimation} style={{ marginTop: '12px' }}>
              播放动画测试
            </button>
          </div>

          <h2 className="panel-title">CSS 输出代码</h2>
          <pre className="json-preview" style={{ background: '#282c34', color: '#abb2bf', padding: '12px', borderRadius: '4px' }}>
            <code>
              {`transition-timing-function: ${bezierString};`}
            </code>
          </pre>

          <h2 className="panel-title" style={{ marginTop: '24px' }}>预设曲线 (Presets)</h2>
          <div className="dsl-hero-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
            {Object.keys(PRESETS).map((key) => (
              <button key={key} onClick={() => applyPreset(key)}>
                {key}
              </button>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}