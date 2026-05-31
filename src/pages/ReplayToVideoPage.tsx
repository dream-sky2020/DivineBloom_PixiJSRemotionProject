import { useState, useRef, useEffect } from 'react';
import { PixiXmlLoader } from '../pixiJSRenderer/PixiXmlLoader';
import type { LoadedCanvas } from '../pixiJSRenderer/PixiXmlLoader';
import { PixiJsonLoader } from '../pixiJSRenderer/PixiJsonLoader';
import { PixiXmlExporter } from '../pixiJSRenderer/PixiXmlExporter';
import { PixiXmlPlayerCanvas } from '../components/PixiXmlPlayerCanvas';
import { toast } from '../components/Toast';

export function ReplayToVideoPage() {
  const [loadedCanvas, setLoadedCanvas] = useState<LoadedCanvas | null>(null);
  const [renderXmlContent, setRenderXmlContent] = useState<string>('');
  const [sourceFormat, setSourceFormat] = useState<'xml' | 'json' | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState('请上传 XML 或 JSON 录制文件');
  const [isRendering, setIsRendering] = useState(false);
  const playTimerRef = useRef<number | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const lowerName = file.name.toLowerCase();
        const isJsonFile = lowerName.endsWith('.json');
        const isXmlFile = lowerName.endsWith('.xml');

        let result: LoadedCanvas;
        let xmlForRender: string;
        let parsedFormat: 'xml' | 'json';

        if (isJsonFile || (!isXmlFile && content.trimStart().startsWith('{'))) {
          result = PixiJsonLoader.load(content);
          parsedFormat = 'json';
          xmlForRender = PixiXmlExporter.export(result.frames, {
            name: result.name,
            width: result.width,
            height: result.height,
            fps: result.fps,
          });
        } else {
          result = PixiXmlLoader.load(content);
          parsedFormat = 'xml';
          xmlForRender = content;
        }

        setRenderXmlContent(xmlForRender);
        setSourceFormat(parsedFormat);
        setLoadedCanvas(result);
        setCurrentFrame(0);
        setIsPlaying(true);
        setStatus(`已加载 ${parsedFormat.toUpperCase()}: ${result.name} (${result.totalFrames} 帧)`);
        toast.success(`${parsedFormat.toUpperCase()} 加载成功`);
      } catch (err) {
        console.error(err);
        toast.error('文件解析失败，请检查 XML/JSON 格式');
      }
    };
    reader.readAsText(file);
  };

  const renderToVideo = async () => {
    if (!loadedCanvas || !renderXmlContent) return;

    setIsRendering(true);
    setStatus('正在导出视频，请稍候...');

    try {
      const response = await fetch('http://127.0.0.1:8787/render-xml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xml: renderXmlContent,
          name: loadedCanvas.name,
          width: loadedCanvas.width,
          height: loadedCanvas.height,
          fps: loadedCanvas.fps,
          totalFrames: loadedCanvas.totalFrames,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? '渲染失败');
      }

      setStatus(`渲染完成：${result.output}`);
      toast.success('视频渲染成功');
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : '渲染请求失败');
      toast.error('视频渲染失败');
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    if (isPlaying && loadedCanvas) {
      const interval = 1000 / loadedCanvas.fps;
      playTimerRef.current = window.setInterval(() => {
        setCurrentFrame((prev) => {
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
        <p className="eyebrow">XML/JSON Playback</p>
        <h1>录制回放与导出视频</h1>
        <p className="summary">
          上传由游戏页面导出的 XML 或 JSON 录制文件，还原当时的 PixiJS 画布内容并导出视频。
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
            accept=".xml,.json,application/json,text/xml"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="xml-upload"
          />
          <label htmlFor="xml-upload" className="button primary" style={{ cursor: 'pointer', display: 'inline-block', padding: '8px 16px', borderRadius: '6px', background: 'var(--blue)', color: 'white' }}>
            上传 XML/JSON 文件
          </label>

          {loadedCanvas && (
            <>
              <button className="primary" onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? '暂停' : '播放'}
              </button>
              <button
                className="record"
                onClick={renderToVideo}
                disabled={isRendering}
                style={{ marginLeft: '12px' }}
              >
                {isRendering ? '正在渲染...' : 'Remotion 导出视频'}
              </button>
              <span style={{ marginLeft: '16px' }}>
                来源: {sourceFormat ? sourceFormat.toUpperCase() : '-'} | 帧: {currentFrame} / {loadedCanvas.totalFrames - 1}
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
