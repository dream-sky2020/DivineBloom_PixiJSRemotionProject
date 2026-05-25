import { useState } from 'react';
import { PixiBounceCanvas } from '../components/PixiBounceCanvas';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '../simulation';

type RenderResponse = {
  ok: boolean;
  output?: string;
  error?: string;
};

const DEFAULT_SEED = 'new-world';

export function SimulationPage() {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [running, setRunning] = useState(false);
  const [fromFrame, setFromFrame] = useState(0);
  const [toFrame, setToFrame] = useState(240);
  const [fps, setFps] = useState(60);
  const [status, setStatus] = useState('等待录制任务');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        <PixiBounceCanvas seed={seed} running={running} />
      </section>

      <section className="controls">
        <label>
          随机种子
          <input value={seed} onChange={(event) => setSeed(event.target.value)} />
        </label>

        <button className="primary" onClick={() => setRunning((value) => !value)}>
          {running ? '暂停' : '开始'}
        </button>

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
          {isSubmitting ? '录制中...' : '录制'}
        </button>
      </section>

      <p className="status">{status}</p>
    </div>
  );
}
