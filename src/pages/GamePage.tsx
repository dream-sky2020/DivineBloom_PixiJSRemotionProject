import { useState, useRef, useCallback } from 'react';
import { PixiBounceCanvas } from '../components/PixiBounceCanvas';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '../simulation';
import type { PixiReadonlyFrameStateMap } from '../pixiJSRenderer/types';
import { PixiXmlExporter } from '../pixiJSRenderer/PixiXmlExporter';
import { toast } from '../components/Toast';

type RenderResponse = {
  ok: boolean;
  output?: string;
  error?: string;
};

const DEFAULT_SEED = 'new-world';
const MAX_RECORD_FRAMES = 10000;

export function GamePage() {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [running, setRunning] = useState(false);
  const [fromFrame, setFromFrame] = useState(0);
  const [toFrame, setToFrame] = useState(240);
  const [fps, setFps] = useState(60);
  const [status, setStatus] = useState('等待录制任务');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 录制相关状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordedCount, setRecordedCount] = useState(0);
  const recordedFramesRef = useRef<PixiReadonlyFrameStateMap[]>([]);

  const handleFrame = useCallback((_frameIndex: number, state: PixiReadonlyFrameStateMap) => {
    if (!isRecording) return;

    // 复制当前帧状态并存入数组
    // 注意：state 是 Map，需要克隆一份以防后续帧修改
    recordedFramesRef.current.push(new Map(state));
    setRecordedCount(recordedFramesRef.current.length);

    if (recordedFramesRef.current.length >= MAX_RECORD_FRAMES) {
      stopRecording();
      toast.warning('录制已达到最大帧数限制 (10000帧)');
    }
  }, [isRecording]);

  const startRecording = () => {
    recordedFramesRef.current = [];
    setRecordedCount(0);
    setIsRecording(true);
    setRunning(true);
    setStatus('正在录制中...');
  };

  const stopRecording = () => {
    setIsRecording(false);
    const frames = recordedFramesRef.current;
    
    if (frames.length === 0) {
      setStatus('录制结束，但未捕获到任何帧');
      return;
    }

    // 导出 XML
    const xml = PixiXmlExporter.export(frames, {
      name: `record_${seed}_${Date.now()}`,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      fps: fps
    });

    // 下载 XML 文件
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording_${seed}.xml`;
    a.click();
    URL.revokeObjectURL(url);

    setStatus(`录制结束，共捕获 ${frames.length} 帧，已导出 XML`);
  };

  const record = async () => {
    if (toFrame <= fromFrame) {
      setStatus('结束计算帧必须大于开始计算帧');
      return;
    }

    setIsSubmitting(true);
    setStatus('已提交给 Python 服务，正在调用 Remotion...');

    try {
      const response = await fetch('http://127.0.0.1:8787/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed,
          fromFrame,
          toFrame,
          fps,
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
        }),
      });

      const result = (await response.json()) as RenderResponse;
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? '录制失败');
      }

      setStatus(`录制完成：${result.output}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '录制请求失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">PixiJS + Remotion</p>
        <h1>确定性弹跳画布录制</h1>
        <p className="summary">
          输入随机种子后开始模拟，录制时把计算帧范围提交给 Python 服务，再由 Remotion 渲染视频。
        </p>
      </section>

      <section className="stage-card">
        <PixiBounceCanvas seed={seed} running={running} onFrame={handleFrame} />
      </section>

      <section className="controls">
        <div className="control-group">
          <label>
            随机种子
            <input value={seed} onChange={(event) => setSeed(event.target.value)} />
          </label>

          <button className="primary" onClick={() => setRunning((value) => !value)}>
            {running ? '暂停' : '开始'}
          </button>
        </div>

        <div className="control-group record-group" style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <span style={{ marginRight: '16px', fontWeight: 'bold', color: isRecording ? '#ff4d4f' : 'inherit' }}>
            {isRecording ? `🔴 录制中: ${recordedCount} 帧` : `已就绪 (最大 10000 帧)`}
          </span>
          {!isRecording ? (
            <button className="primary" onClick={startRecording}>开始本地录制 (XML)</button>
          ) : (
            <button className="record" onClick={stopRecording}>停止并导出 XML</button>
          )}
        </div>

        <div className="control-divider" style={{ margin: '20px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}></div>

        <div className="control-group">
          <label>
            起始计算帧
            <input
              min={0}
              type="number"
              value={fromFrame}
              onChange={(event) => setFromFrame(Number(event.target.value))}
            />
          </label>

          <label>
            结束计算帧
            <input
              min={1}
              type="number"
              value={toFrame}
              onChange={(event) => setToFrame(Number(event.target.value))}
            />
          </label>

          <label>
            FPS
            <input
              min={1}
              max={120}
              type="number"
              value={fps}
              onChange={(event) => setFps(Number(event.target.value))}
            />
          </label>

          <button className="record" disabled={isSubmitting} onClick={record}>
            {isSubmitting ? '渲染中...' : 'Remotion 远程渲染'}
          </button>
        </div>
      </section>

      <p className="status">{status}</p>
    </div>
  );
}
