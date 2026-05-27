import { useEffect, useState } from 'react';
import { DslSceneCanvas } from '../components/DslSceneCanvas';
import { toast } from '../components/Toast';
import { parseRenderingDsl } from '../dsl/renderingDslConvert';
import type { CanvasRenderDocument } from '../dsl/types';

const DEFAULT_RENDER_WIDTH = 1920;
const DEFAULT_RENDER_HEIGHT = 1080;
const FILE_SERVER_URL = 'http://127.0.0.1:8787';

type RenderTargetInfo = {
  name: string;
  width: number;
  height: number;
  totalFrames: number;
};

export function DslToVideoPage() {
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [parsedDocument, setParsedDocument] = useState<CanvasRenderDocument | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_RENDER_WIDTH);
  const [previewHeight, setPreviewHeight] = useState(DEFAULT_RENDER_HEIGHT);
  const [status, setStatus] = useState('请选择本地 dxml/xml 文件');
  const [currentRenderTarget, setCurrentRenderTarget] = useState<RenderTargetInfo | null>(null);
  const [isPickingFile, setIsPickingFile] = useState(false);
  const [isRenderingFile, setIsRenderingFile] = useState(false);
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
      ? `Canvas ${currentRenderTarget.name}\n分辨率 ${currentRenderTarget.width}x${currentRenderTarget.height}\n${message}`
      : fallbackDescription;
    const title = currentRenderTarget
      ? `Canvas 渲染失败：${currentRenderTarget.name}`
      : '画布渲染失败';

    setStatus(description.replace(/\n/g, ' | '));
    toast.error(title, {
      description,
      duration: 0,
    });
  };

  const handleFrameIndexChange = (frameIndex: number, doc?: CanvasRenderDocument | null) => {
    const targetDoc = doc || parsedDocument;
    if (!targetDoc) return;

    const maxFrameIndex = Math.max((targetDoc.totalFrames ?? 1) - 1, 0);
    const safeFrameIndex = Math.min(Math.max(frameIndex, 0), maxFrameIndex);
    
    setCurrentFrameIndex(safeFrameIndex);
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
      setCurrentFrameIndex(0);
      setCurrentRenderTarget(null);
      setIsPlayingVideo(false);
      setPreviewWidth(DEFAULT_RENDER_WIDTH);
      setPreviewHeight(DEFAULT_RENDER_HEIGHT);
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

      setStatus(`已加载文件：${readableFileName(pickedPath)}，点击“渲染文件”开始渲染`);
    } catch (error) {
      reportFileReadFailure(error instanceof Error ? error.message : '读取本地文件失败');
    } finally {
      setIsPickingFile(false);
    }
  };

  const handleConvert = async () => {
    if (!selectedFilePath.trim()) {
      setStatus('请先选择 dxml/xml 文件');
      toast.warning('未加载文件', {
        description: '请先点击“选择 dxml/xml 文件”并选择本地文件，再执行渲染',
      });
      return;
    }

    try {
      setIsRenderingFile(true);
      setStatus(`正在从后端读取最新文件内容：${selectedFilePath}`);

      const readResponse = await fetch(
        `${FILE_SERVER_URL}/file/read?path=${encodeURIComponent(selectedFilePath)}`,
      );
      const readResult = (await readResponse.json()) as {
        ok: boolean;
        content?: string;
        error?: string;
      };
      if (!readResponse.ok || !readResult.ok) {
        throw new Error(readResult.error ?? '读取文件内容失败');
      }

      const latestDsl = readResult.content ?? '';
      if (!latestDsl.trim()) {
        throw new Error('文件内容为空，无法渲染');
      }

      const parsed = parseRenderingDsl(latestDsl);
      const doc = parsed.document;
      
      setIsPlayingVideo(false);
      setParsedDocument(doc);
      
      const width = doc.width ?? DEFAULT_RENDER_WIDTH;
      const height = doc.height ?? DEFAULT_RENDER_HEIGHT;
      const totalFrames = doc.totalFrames ?? 1;

      setPreviewWidth(width);
      setPreviewHeight(height);
      setCurrentRenderTarget({
        name: doc.name ?? 'Untitled',
        width,
        height,
        totalFrames,
      });

      handleFrameIndexChange(0, doc);
      setStatus(`已加载 Canvas ${doc.name ?? 'Untitled'}（${width}x${height}），共 ${totalFrames} 帧（fps=${doc.fps ?? 30}）`);
      
    } catch (error) {
      setIsPlayingVideo(false);
      setParsedDocument(null);
      setCurrentFrameIndex(0);
      setCurrentRenderTarget(null);
      setPreviewWidth(DEFAULT_RENDER_WIDTH);
      setPreviewHeight(DEFAULT_RENDER_HEIGHT);
      const message = error instanceof Error ? error.message : 'DSL 解析失败';
      if (message.includes('读取文件')) {
        reportFileReadFailure(message);
      } else {
        reportParseFailure(message);
      }
    } finally {
      setIsRenderingFile(false);
    }
  };

  const maxFrames = currentRenderTarget?.totalFrames ?? 1;
  const isVideo = maxFrames > 1;

  const playbackStatusText =
    isPlayingVideo && isVideo
      ? `播放中：帧 ${currentFrameIndex} / ${maxFrames - 1}`
      : '';

  useEffect(() => {
    if (!isPlayingVideo || !parsedDocument || !isVideo) {
      return;
    }

    const fps = parsedDocument.fps ?? 30;
    const intervalMs = Math.max(16, Math.round(1000 / Math.max(1, fps)));
    
    const timer = window.setInterval(() => {
      setCurrentFrameIndex((prevIndex) => (prevIndex + 1) % maxFrames);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlayingVideo, parsedDocument, isVideo, maxFrames]);

  return (
    <div className="app-shell">
      <section className="hero">
        <p className="eyebrow">DXML to Canvas</p>
        <h1>DSL 脚本转换</h1>
        <p className="summary">
          在 VSCode 中编辑本地 dxml/xml 文件，网页端只负责选取文件、渲染预览与结构化结果查看。
        </p>
        <div className="dsl-hero-actions">
          <button className="primary" disabled={isPickingFile} onClick={() => void handlePickFile()}>
            {isPickingFile ? '正在选择文件...' : '选择 dxml/xml 文件'}
          </button>
          <button className="primary" disabled={isRenderingFile} onClick={() => void handleConvert()}>
            {isRenderingFile ? '正在读取并渲染...' : '渲染文件'}
          </button>
        </div>
        <p className="dsl-file-path">
          {selectedFilePath ? `当前文件：${selectedFilePath}` : '当前文件：未选择'}
        </p>
      </section>

      <div className="workspace-grid dsl-workspace-grid">
        <section className="stage-card workspace-panel dsl-preview-panel">
          <h2 className="panel-title">图像预览</h2>
          
          <div className="dsl-frame-toolbar">
            <button
              disabled={!isVideo}
              onClick={() => handleFrameIndexChange(currentFrameIndex - 1)}
            >
              上一帧
            </button>
            <button
              className={isPlayingVideo ? 'record' : 'primary'}
              disabled={!isVideo}
              onClick={() => setIsPlayingVideo((value) => !value)}
            >
              {isPlayingVideo ? '暂停' : '播放'}
            </button>
            <label className="dsl-frame-input">
              帧索引
              <input
                min={0}
                max={Math.max(maxFrames - 1, 0)}
                type="number"
                value={currentFrameIndex}
                disabled={!isVideo}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) {
                    handleFrameIndexChange(next);
                  }
                }}
              />
            </label>
            <button
              disabled={!isVideo}
              onClick={() => handleFrameIndexChange(currentFrameIndex + 1)}
            >
              下一帧
            </button>
            <span className="dsl-frame-info">
              帧: {currentFrameIndex} / 总计 {maxFrames} 帧
            </span>
          </div>
          
          <div className="dsl-preview-center">
            {/* 更改此处：不再传递 frame，而是传递完整的 document 和当前帧号 */}
            <DslSceneCanvas
              frame={parsedDocument}
              width={previewWidth}
              height={previewHeight}
              onRenderError={(message) => reportRenderFailure(message)}
            />
          </div>
          <h2 className="panel-title">结构化数据 (CanvasRenderDocument)</h2>
          <pre className="json-preview">
            {parsedDocument ? JSON.stringify(parsedDocument, null, 2) : '转换后会在这里显示结构化图像数据'}
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