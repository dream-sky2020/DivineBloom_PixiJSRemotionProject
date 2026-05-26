import { useEffect, useState } from 'react';
import { DslSceneCanvas } from '../components/DslSceneCanvas';
import { toast } from '../components/Toast';
import { parseRenderingDsl } from '../dsl/renderingDslParser';
import type { RenderDocument, SceneFrame } from '../types/rendering';

const DEFAULT_RENDER_WIDTH = 1920;
const DEFAULT_RENDER_HEIGHT = 1080;
const FILE_SERVER_URL = 'http://127.0.0.1:8787';

type RenderTargetInfo = {
  documentType: 'Image' | 'Video';
  name: string;
  frameId: string;
  width: number;
  height: number;
};

export function DslToImagePage() {
  const [dsl, setDsl] = useState('');
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [parsedDocument, setParsedDocument] = useState<RenderDocument | null>(null);
  const [sceneFrame, setSceneFrame] = useState<SceneFrame | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_RENDER_WIDTH);
  const [previewHeight, setPreviewHeight] = useState(DEFAULT_RENDER_HEIGHT);
  const [previewTransparent, setPreviewTransparent] = useState(false);
  const [status, setStatus] = useState('请选择本地 dxml/xml 文件');
  const [currentRenderTarget, setCurrentRenderTarget] = useState<RenderTargetInfo | null>(null);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);

  const reportParseFailure = (message: string) => {
    const target = selectedFilePath ? `文件 ${selectedFilePath}` : '当前文件';
    const description = `${target}\n${message}`;
    setStatus(`${target} 解析失败：${message}`);
    toast.error('DSL 解析失败', {
      description,
      duration: 0,
    });
  };

  const reportFileReadFailure = (message: string) => {
    const target = selectedFilePath ? `文件 ${selectedFilePath}` : '所选文件';
    const description = `${target}\n${message}`;
    setStatus(`${target} 读取失败：${message}`);
    toast.error('文件读取失败', {
      description,
      duration: 0,
    });
  };

  const reportRenderFailure = (message: string) => {
    const fallbackDescription = `未定位到渲染目标\n${message}`;
    const description = currentRenderTarget
      ? `${currentRenderTarget.documentType} ${currentRenderTarget.name}\nFRAME ${currentRenderTarget.frameId}\n分辨率 ${currentRenderTarget.width}x${currentRenderTarget.height}\n${message}`
      : fallbackDescription;
    const title = currentRenderTarget
      ? `${currentRenderTarget.documentType} 渲染失败：${currentRenderTarget.name}`
      : '画布渲染失败';

    setStatus(description.replace(/\n/g, ' | '));
    toast.error(title, {
      description,
      duration: 0,
    });
  };

  const setActiveFrame = (document: RenderDocument, frameIndex: number) => {
    const maxFrameIndex = document.frames.length - 1;
    if (maxFrameIndex < 0) {
      return;
    }

    const safeFrameIndex = Math.min(Math.max(frameIndex, 0), maxFrameIndex);
    const frame = document.frames[safeFrameIndex];
    if (!frame) {
      return;
    }

    setCurrentFrameIndex(safeFrameIndex);
    setSceneFrame(frame);
    setCurrentRenderTarget({
      documentType: document.type === 'image' ? 'Image' : 'Video',
      name: document.name,
      frameId: frame.id,
      width: document.width,
      height: document.height,
    });
  };

  const handlePickFile = async () => {
    setIsPickingFile(true);
    setStatus('正在打开系统文件选择框...');

    try {
      const pickResponse = await fetch(`${FILE_SERVER_URL}/file/pick`);
      const pickResult = (await pickResponse.json()) as {
        ok: boolean;
        path?: string;
        error?: string;
      };
      if (!pickResponse.ok || !pickResult.ok) {
        throw new Error(pickResult.error ?? '打开文件选择框失败');
      }

      const pickedPath = pickResult.path ?? '';
      if (!pickedPath) {
        setStatus('已取消文件选择');
        return;
      }

      setSelectedFilePath(pickedPath);
      setParsedDocument(null);
      setSceneFrame(null);
      setCurrentFrameIndex(0);
      setCurrentRenderTarget(null);
      setIsPlayingVideo(false);
      setPreviewWidth(DEFAULT_RENDER_WIDTH);
      setPreviewHeight(DEFAULT_RENDER_HEIGHT);
      setPreviewTransparent(false);
      setStatus(`已选择文件：${pickedPath}`);

      const readResponse = await fetch(
        `${FILE_SERVER_URL}/file/read?path=${encodeURIComponent(pickedPath)}`,
      );
      const readResult = (await readResponse.json()) as {
        ok: boolean;
        content?: string;
        error?: string;
      };
      if (!readResponse.ok || !readResult.ok) {
        throw new Error(readResult.error ?? '读取文件内容失败');
      }

      const content = readResult.content ?? '';
      setDsl(content);
      setStatus(`已加载文件：${readableFileName(pickedPath)}，点击“渲染文件”开始渲染`);
    } catch (error) {
      setDsl('');
      reportFileReadFailure(error instanceof Error ? error.message : '读取本地文件失败');
    } finally {
      setIsPickingFile(false);
    }
  };

  const handleConvert = () => {
    if (!dsl.trim()) {
      setStatus('请先选择并加载 dxml/xml 文件');
      toast.warning('未加载文件', {
        description: '请先点击“选择 dxml/xml 文件”并选择本地文件',
      });
      return;
    }

    try {
      const parsed = parseRenderingDsl(dsl);
      setIsPlayingVideo(false);
      setParsedDocument(parsed.document);
      setPreviewWidth(parsed.document.width);
      setPreviewHeight(parsed.document.height);
      setPreviewTransparent(parsed.document.type === 'image' ? parsed.document.transparent : false);

      if (parsed.document.frames.length === 0) {
        setSceneFrame(null);
        setCurrentFrameIndex(0);
        setCurrentRenderTarget(null);
        setPreviewTransparent(false);
        setStatus(
          `${parsed.document.type === 'image' ? 'Image' : 'Video'} ${parsed.document.name} 没有解析到可渲染的 FRAME`,
        );
        toast.warning('未找到可渲染帧', {
          description: `${parsed.document.type === 'image' ? 'Image' : 'Video'} ${parsed.document.name} 没有可渲染 FRAME`,
        });
        return;
      }

      setActiveFrame(parsed.document, 0);
      if (parsed.document.type === 'image') {
        const firstFrame = parsed.document.frames[0];
        setStatus(
          `已渲染 Image ${parsed.document.name}（${parsed.document.width}x${parsed.document.height}）的 FRAME ${firstFrame.id}，共 ${firstFrame.objects.length} 个渲染对象`,
        );
      } else {
        const firstFrame = parsed.document.frames[0];
        setStatus(
          `已加载 Video ${parsed.document.name}（${parsed.document.width}x${parsed.document.height}），当前 FRAME ${firstFrame.id}，共 ${parsed.document.frames.length} 帧（DSL 声明 totalFrames=${parsed.document.totalFrames}，fps=${parsed.document.fps}）`,
        );
      }
    } catch (error) {
      setIsPlayingVideo(false);
      setParsedDocument(null);
      setSceneFrame(null);
      setCurrentFrameIndex(0);
      setCurrentRenderTarget(null);
      setPreviewWidth(DEFAULT_RENDER_WIDTH);
      setPreviewHeight(DEFAULT_RENDER_HEIGHT);
      setPreviewTransparent(false);
      reportParseFailure(error instanceof Error ? error.message : 'DSL 解析失败');
    }
  };

  const handleFrameIndexChange = (nextFrameIndex: number) => {
    if (!parsedDocument || parsedDocument.type !== 'video') {
      return;
    }
    setActiveFrame(parsedDocument, nextFrameIndex);
  };

  const playbackStatusText =
    isPlayingVideo && parsedDocument?.type === 'video'
      ? `播放中：${currentFrameIndex} / ${Math.max(parsedDocument.frames.length - 1, 0)}，FRAME ID=${sceneFrame?.id ?? '-'}`
      : '';

  useEffect(() => {
    if (!isPlayingVideo || !parsedDocument || parsedDocument.type !== 'video') {
      return;
    }
    if (parsedDocument.frames.length <= 1) {
      return;
    }

    const intervalMs = Math.max(16, Math.round(1000 / Math.max(1, parsedDocument.fps)));
    const timer = window.setInterval(() => {
      const nextFrameIndex = (currentFrameIndex + 1) % parsedDocument.frames.length;
      setActiveFrame(parsedDocument, nextFrameIndex);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [currentFrameIndex, isPlayingVideo, parsedDocument]);

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">DXML to Image</p>
        <h1>DSL 脚本转换</h1>
        <p className="summary">
          在 VSCode 中编辑本地 dxml/xml 文件，网页端只负责选取文件、渲染预览与结构化结果查看。
        </p>
        <div className="dsl-hero-actions">
          <button className="primary" disabled={isPickingFile} onClick={() => void handlePickFile()}>
            {isPickingFile ? '正在选择文件...' : '选择 dxml/xml 文件'}
          </button>
          <button className="primary" onClick={handleConvert}>
            渲染文件
          </button>
        </div>
        <p className="dsl-file-path">
          {selectedFilePath ? `当前文件：${selectedFilePath}` : '当前文件：未选择'}
        </p>
      </section>

      <div className="workspace-grid dsl-workspace-grid">
        <section className="stage-card workspace-panel dsl-preview-panel">
          <h2 className="panel-title">图像预览</h2>
          {parsedDocument?.type === 'video' ? (
            <div className="dsl-frame-toolbar">
              <button
                onClick={() => {
                  handleFrameIndexChange(currentFrameIndex - 1);
                }}
              >
                上一帧
              </button>
              <button
                className={isPlayingVideo ? 'record' : 'primary'}
                disabled={parsedDocument.frames.length <= 1}
                onClick={() => {
                  setIsPlayingVideo((value) => !value);
                }}
              >
                {isPlayingVideo ? '暂停' : '播放'}
              </button>
              <label className="dsl-frame-input">
                帧索引
                <input
                  min={0}
                  max={Math.max(parsedDocument.frames.length - 1, 0)}
                  type="number"
                  value={currentFrameIndex}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) {
                      handleFrameIndexChange(next);
                    }
                  }}
                />
              </label>
              <button
                onClick={() => {
                  handleFrameIndexChange(currentFrameIndex + 1);
                }}
              >
                下一帧
              </button>
              <span className="dsl-frame-info">
                FRAME ID: {sceneFrame?.id ?? '-'} / 共 {parsedDocument.frames.length} 帧
              </span>
            </div>
          ) : null}
          <div className="dsl-preview-center">
            <DslSceneCanvas
              frame={sceneFrame}
              width={previewWidth}
              height={previewHeight}
              transparent={previewTransparent}
              onRenderError={reportRenderFailure}
            />
          </div>
          <h2 className="panel-title">结构化数据</h2>
          <pre className="json-preview">
            {sceneFrame ? JSON.stringify(sceneFrame, null, 2) : '转换后会在这里显示结构化图像数据'}
          </pre>
        </section>
      </div>

      <p className="status">
        {playbackStatusText ? `${status} | ${playbackStatusText}` : status}
      </p>
    </div>
  );
}

function readableFileName(path: string) {
  const normalized = path.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  if (index < 0) {
    return normalized;
  }
  return normalized.slice(index + 1) || normalized;
}
