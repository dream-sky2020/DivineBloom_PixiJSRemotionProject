import { useEffect, useRef, useState } from 'react';
import { DslEditor } from '../components/DslEditor';
import { DslSceneCanvas } from '../components/DslSceneCanvas';
import { parseRenderingDsl } from '../dsl/renderingDslParser';
import { loadDslToImageDraft, saveDslToImageDraft } from '../store/dslDraftStore';
import type { SceneFrame } from '../types/rendering';

const RENDER_DSL_SCHEMA_URL = '/doc/render_dsl.xsd';

const DEFAULT_DSL = `<Image name="hero_poster" transparent="false">
  <FRAME id="0" cameraX="0.0" cameraY="0.0">
    <SPRITE
      id="favicon_preview"
      image="favicon"
      x="640"
      y="360"
      anchorX="0.5"
      anchorY="0.5"
      scaleX="4"
      scaleY="4"
      rotation="0"
      alpha="0.9"
      visible="true"
      blendMode="normal"
      tint="0xffffff"
      zIndex="10"
    />
  </FRAME>
</Image>`;

export function DslToImagePage() {
  const [dsl, setDsl] = useState(DEFAULT_DSL);
  const [sceneFrame, setSceneFrame] = useState<SceneFrame | null>(null);
  const [previewTransparent, setPreviewTransparent] = useState(false);
  const [status, setStatus] = useState('正在加载 DSL 草稿...');
  const draftLoadedRef = useRef(false);

  useEffect(() => {
    let disposed = false;

    void loadDslToImageDraft()
      .then((savedDsl) => {
        if (disposed) {
          return;
        }

        if (savedDsl !== undefined) {
          setDsl(savedDsl);
          setStatus('已恢复上次编辑的 DSL 草稿');
        } else {
          setStatus('等待输入 DSL 脚本');
        }
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setStatus(error instanceof Error ? error.message : 'DSL 草稿加载失败');
        }
      })
      .finally(() => {
        if (!disposed) {
          draftLoadedRef.current = true;
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!draftLoadedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveDslToImageDraft(dsl).catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'DSL 草稿保存失败');
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [dsl]);

  const handleConvert = () => {
    try {
      const parsed = parseRenderingDsl(dsl);
      const firstFrame = parsed.frames[0];

      if (!firstFrame) {
        setSceneFrame(null);
        setPreviewTransparent(false);
        setStatus('没有解析到可渲染的 FRAME 指令');
        return;
      }

      setSceneFrame(firstFrame.scene);
      setPreviewTransparent(parsed.document.type === 'image' ? parsed.document.transparent : false);
      setStatus(
        `已解析 ${parsed.document.type === 'image' ? 'Image' : 'Video'} ${parsed.document.name} 的 FRAME ${firstFrame.frameId}，共 ${firstFrame.scene.objects.length} 个渲染对象`,
      );
    } catch (error) {
      setSceneFrame(null);
      setPreviewTransparent(false);
      setStatus(error instanceof Error ? error.message : 'DSL 解析失败');
    }
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

      <div className="workspace-grid">
        <section className="stage-card workspace-panel">
          <h2 className="panel-title">DSL 输入</h2>
          <DslEditor
            value={dsl}
            onChange={setDsl}
            placeholder="请输入 DSL 脚本..."
            schemaUrl={RENDER_DSL_SCHEMA_URL}
          />
          <button className="primary" onClick={handleConvert}>
            转换为图像
          </button>
        </section>

        <section className="stage-card workspace-panel">
          <h2 className="panel-title">图像预览</h2>
          <DslSceneCanvas
            frame={sceneFrame}
            transparent={previewTransparent}
            onRenderError={setStatus}
          />
          <h2 className="panel-title">结构化数据</h2>
          <pre className="json-preview">
            {sceneFrame ? JSON.stringify(sceneFrame, null, 2) : '转换后会在这里显示结构化图像数据'}
          </pre>
        </section>
      </div>

      <p className="status">{status}</p>
    </div>
  );
}
