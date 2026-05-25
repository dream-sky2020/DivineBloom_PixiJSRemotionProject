import { useState } from 'react';
import { DslEditor } from '../components/DslEditor';

export function DslToImagePage() {
  const [dsl, setDsl] = useState('');
  const [status, setStatus] = useState('等待输入 DSL 脚本');

  const handleConvert = () => {
    setStatus('转换功能尚未实现');
  };

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">DSL to Image</p>
        <h1>DSL 脚本转换</h1>
        <p className="summary">
          在此输入您的 DSL 脚本，将其转换为图像。
        </p>
      </section>

      <section className="stage-card" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <DslEditor 
          value={dsl} 
          onChange={setDsl} 
          placeholder="请输入 DSL 脚本..."
        />
        <button className="primary" onClick={handleConvert} style={{ alignSelf: 'flex-end' }}>
          转换为图像
        </button>
      </section>

      <p className="status">{status}</p>
    </div>
  );
}
