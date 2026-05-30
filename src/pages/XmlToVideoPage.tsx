import { useState, useRef, useEffect } from 'react';
import { PixiXmlLoader } from '../pixiJSRenderer/PixiXmlLoader';
import type { LoadedCanvas } from '../pixiJSRenderer/PixiXmlLoader';
import { PixiXmlPlayerCanvas } from '../components/PixiXmlPlayerCanvas';
import { toast } from '../components/Toast';

export function XmlToVideoPage() {
  const [loadedCanvas, setLoadedCanvas] = useState<LoadedCanvas | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('请上传 XML 录制文件');
  const playTimerRef = useRef<number | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlContent = e.target?.result as string;
        const result = PixiXmlLoader.load(xmlContent);
        setLoadedCanvas(result);
        setCurrentFrame(0);
        setIsPlaying(true);
        setStatus(`已加载: ${result.name} (${result.totalFrames} 帧)`);
        toast.success('XML 加载成功');
      } catch (err) {
        console.error(err);
        toast.error('XML 解析失败，请检查文件格式');
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (isPlaying && loadedCanvas) {
      const interval = 1000 / loadedCanvas.fps;
      playTimerRef.current = window.setInterval(() => {
        setCurrentFrame(prev => {
          const next = prev + 1;
          return next >= loadedCanvas.totalFrames ? 0 : next;
        });
      }, interval);
    } else {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, loadedCanvas]);

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">XML Playback</p>
        <h1>XML 录制回放</h1>
        <p className="summary">
          上传由游戏页面导出的 XML 录制文件，还原当时的 PixiJS 画布内容。
        </p>
      </section>

      <section className="stage-card">
        {loadedCanvas ? (
          <PixiXmlPlayerCanvas
            loadedCanvas={loadedCanvas}
            currentFrame={currentFrame}
            className="pixi-host"
          />
        ) : (
          <div className="empty-state" style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
            {status}
          </div>
        )}
      </section>

      <section className="controls">
        <div className="control-group">
          <input 
            type="file" 
            accept=".xml" 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
            id="xml-upload"
          />
          <label htmlFor="xml-upload" className="button primary" style={{ cursor: 'pointer', display: 'inline-block', padding: '8px 16px', borderRadius: '6px', background: 'var(--blue)', color: 'white' }}>
            上传 XML 文件
          </label>

          {loadedCanvas && (
            <>
              <button className="primary" onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? '暂停' : '播放'}
              </button>
              <span style={{ marginLeft: '16px' }}>
                帧: {currentFrame} / {loadedCanvas.totalFrames - 1}
              </span>
              <input 
                type="range" 
                min={0} 
                max={loadedCanvas.totalFrames - 1} 
                value={currentFrame} 
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentFrame(parseInt(e.target.value));
                }}
                style={{ width: '300px', marginLeft: '20px' }}
              />
            </>
          )}
        </div>
      </section>

      <p className="status">{status}</p>
    </div>
  );
}
