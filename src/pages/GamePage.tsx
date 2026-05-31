import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PixiBounceCanvas,
  type PixiBattleRenderMode,
  type PixiBattleSceneConfig,
  type PixiBattleLayerConfig,
} from '../components/PixiBounceCanvas';
import { DEFAULT_HEIGHT, DEFAULT_WIDTH } from '../simulation';
import type { PixiReadonlyFrameStateMap } from '../pixiJSRenderer/types';
import { PixiXmlExporter } from '../pixiJSRenderer/PixiXmlExporter';
import { PixiJsonExporter } from '../pixiJSRenderer/PixiJsonExporter';
import { toast } from '../components/Toast';

const DEFAULT_SEED = 'new-world';
const MAX_RECORD_FRAMES = 10000;
const DEFAULT_BACKGROUND_TEXTURE = '/image/第九章背景/第九章最后演出back.png';
const DEFAULT_FLOOR_TEXTURE = '/image/第九章背景/第九章最后演出floor.png';
const DEFAULT_CHARACTER_TEXTURE = '/image/君主宝/君主宝/默认-移动/默认.png';

type AssetManifestItem = {
  id: string;
  url: string;
  type: string;
  path: string;
};

type BattleLayerKey = 'background' | 'floor' | 'ceiling' | 'character';

const DEFAULT_BATTLE_SCENE: PixiBattleSceneConfig = {
  camera: {
    x: DEFAULT_WIDTH / 2,
    y: DEFAULT_HEIGHT / 2,
    z: 0,
    focus: 400,
  },
  background: {
    texture: DEFAULT_BACKGROUND_TEXTURE,
    x: DEFAULT_WIDTH / 2,
    y: DEFAULT_HEIGHT * 0.42,
    z: 280,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    rotationX: 0,
    rotationY: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    visible: true,
  },
  floor: {
    texture: DEFAULT_FLOOR_TEXTURE,
    x: DEFAULT_WIDTH / 2,
    y: DEFAULT_HEIGHT * 0.86,
    z: 40,
    scaleX: 1.1,
    scaleY: 1.1,
    rotation: 0,
    rotationX: -0.95,
    rotationY: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    visible: true,
  },
  ceiling: {
    texture: '',
    x: DEFAULT_WIDTH / 2,
    y: DEFAULT_HEIGHT * 0.08,
    z: 320,
    scaleX: 1.05,
    scaleY: 1.05,
    rotation: 0,
    rotationX: 0.95,
    rotationY: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    visible: false,
  },
  character: {
    texture: DEFAULT_CHARACTER_TEXTURE,
    x: DEFAULT_WIDTH * 0.5,
    y: DEFAULT_HEIGHT * 0.76,
    z: 20,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    rotationX: 0,
    rotationY: 0,
    anchorX: 0.5,
    anchorY: 1,
    visible: true,
  },
};

export function GamePage() {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [running, setRunning] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [fps] = useState(60);
  const [status, setStatus] = useState('等待录制任务');

  const handleReset = () => {
    setResetKey(prev => prev + 1);
    setRunning(false);
    setStatus('模拟已重置');
  };

  // 录制相关状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordedCount, setRecordedCount] = useState(0);
  const recordedFramesRef = useRef<PixiReadonlyFrameStateMap[]>([]);
  const [renderMode, setRenderMode] = useState<PixiBattleRenderMode>('physics');
  const [battleScene, setBattleScene] = useState<PixiBattleSceneConfig>(DEFAULT_BATTLE_SCENE);
  const [imageAssets, setImageAssets] = useState<AssetManifestItem[]>([]);

  useEffect(() => {
    const loadManifest = async () => {
      try {
        const response = await fetch('/asset_manifest.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const allAssets = (await response.json()) as AssetManifestItem[];
        setImageAssets(allAssets.filter((item) => item.type === 'image'));
      } catch (error) {
        console.error('加载 asset_manifest 失败:', error);
        toast.warning('加载资产清单失败，纹理下拉列表不可用');
      }
    };

    void loadManifest();
  }, []);

  const startRecording = () => {
    recordedFramesRef.current = [];
    setRecordedCount(0);
    setIsRecording(true);
    setRunning(true);
    setStatus('正在录制中...');
  };

  const stopRecording = (format: 'xml' | 'json') => {
    setIsRecording(false);
    const frames = recordedFramesRef.current;
    
    if (frames.length === 0) {
      setStatus('录制结束，但未捕获到任何帧');
      return;
    }

    if (format === 'xml') {
      const xml = PixiXmlExporter.export(frames, {
        name: `record_${seed}_${Date.now()}`,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        fps: fps
      });

      const blob = new Blob([xml], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording_${seed}.xml`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus(`录制结束，共捕获 ${frames.length} 帧，已导出 XML`);
      return;
    }

    const compressedJson = PixiJsonExporter.export(frames, {
      name: `record_${seed}_${Date.now()}`,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      fps: fps
    });
    const jsonText = JSON.stringify(compressedJson);
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording_${seed}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setStatus(`录制结束，共捕获 ${frames.length} 帧，已导出压缩 JSON`);
  };

  const handleFrame = useCallback((_frameIndex: number, state: PixiReadonlyFrameStateMap) => {
    if (!isRecording) return;

    // 复制当前帧状态并存入数组
    // 注意：state 是 Map，需要克隆一份以防后续帧修改
    recordedFramesRef.current.push(new Map(state));
    setRecordedCount(recordedFramesRef.current.length);

    if (recordedFramesRef.current.length >= MAX_RECORD_FRAMES) {
      stopRecording('xml');
      toast.warning('录制已达到最大帧数限制 (10000帧)');
    }
  }, [isRecording, seed, fps]);

  const updateCamera = <K extends keyof PixiBattleSceneConfig['camera']>(
    key: K,
    value: PixiBattleSceneConfig['camera'][K],
  ) => {
    setBattleScene((prev) => ({
      ...prev,
      camera: {
        ...prev.camera,
        [key]: value,
      },
    }));
  };

  const updateLayer = <K extends keyof PixiBattleLayerConfig>(
    layer: BattleLayerKey,
    key: K,
    value: PixiBattleLayerConfig[K],
  ) => {
    setBattleScene((prev) => ({
      ...prev,
      [layer]: {
        ...prev[layer],
        [key]: value,
      },
    }));
  };

  const pickLocalImageForLayer = async (layer: BattleLayerKey) => {
    try {
      const response = await fetch('http://127.0.0.1:8787/file/pick-image');
      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        url?: string;
      };
      if (!response.ok || !payload.ok || !payload.url) {
        throw new Error(payload.error ?? '图片选择失败');
      }

      updateLayer(layer, 'texture', payload.url);
      updateLayer(layer, 'visible', true);
      setStatus(`已为 ${layer} 设置本地图片纹理`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      toast.error(`选择本地图片失败：${message}`);
    }
  };

  const renderLayerPanel = (layer: BattleLayerKey, title: string) => {
    const layerState = battleScene[layer];

    return (
      <fieldset style={{ marginTop: '12px' }}>
        <legend>{title}</legend>
        <label style={{ marginRight: '8px' }}>
          纹理
          <select
            value={layerState.texture}
            onChange={(event) => updateLayer(layer, 'texture', event.target.value)}
            style={{ marginLeft: '8px', minWidth: '320px' }}
          >
            <option value="">(空)</option>
            {imageAssets.map((asset) => (
              <option key={asset.id} value={asset.url}>
                {asset.id}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="secondary" onClick={() => void pickLocalImageForLayer(layer)}>
          选择本地图片
        </button>
        <label style={{ marginLeft: '12px' }}>
          <input
            type="checkbox"
            checked={layerState.visible}
            onChange={(event) => updateLayer(layer, 'visible', event.target.checked)}
          />
          可见
        </label>

        <div style={{ marginTop: '8px' }}>
          <label> x <input type="number" value={layerState.x} onChange={(e) => updateLayer(layer, 'x', Number(e.target.value))} /> </label>
          <label> y <input type="number" value={layerState.y} onChange={(e) => updateLayer(layer, 'y', Number(e.target.value))} /> </label>
          <label> z <input type="number" value={layerState.z} onChange={(e) => updateLayer(layer, 'z', Number(e.target.value))} /> </label>
        </div>
        <div style={{ marginTop: '8px' }}>
          <label> scaleX <input type="number" step="0.01" value={layerState.scaleX} onChange={(e) => updateLayer(layer, 'scaleX', Number(e.target.value))} /> </label>
          <label> scaleY <input type="number" step="0.01" value={layerState.scaleY} onChange={(e) => updateLayer(layer, 'scaleY', Number(e.target.value))} /> </label>
          <label> rotation <input type="number" step="0.01" value={layerState.rotation} onChange={(e) => updateLayer(layer, 'rotation', Number(e.target.value))} /> </label>
        </div>
        <div style={{ marginTop: '8px' }}>
          <label> rotationX <input type="number" step="0.01" value={layerState.rotationX} onChange={(e) => updateLayer(layer, 'rotationX', Number(e.target.value))} /> </label>
          <label> rotationY <input type="number" step="0.01" value={layerState.rotationY} onChange={(e) => updateLayer(layer, 'rotationY', Number(e.target.value))} /> </label>
          <label> anchorX <input type="number" step="0.01" value={layerState.anchorX} onChange={(e) => updateLayer(layer, 'anchorX', Number(e.target.value))} /> </label>
          <label> anchorY <input type="number" step="0.01" value={layerState.anchorY} onChange={(e) => updateLayer(layer, 'anchorY', Number(e.target.value))} /> </label>
        </div>
      </fieldset>
    );
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
        <PixiBounceCanvas
          seed={seed}
          running={running}
          resetKey={resetKey}
          showDebugOverlay={showDebugOverlay}
          onFrame={handleFrame}
          renderMode={renderMode}
          battleScene={battleScene}
        />
      </section>

      <section className="controls">
        <div className="control-group">
          <label>
            模式
            <select
              value={renderMode}
              onChange={(event) => setRenderMode(event.target.value as PixiBattleRenderMode)}
              style={{ marginLeft: '8px' }}
            >
              <option value="physics">物理弹跳模式</option>
              <option value="battle">伪3D战斗场景模式</option>
            </select>
          </label>

          <label>
            随机种子
            <input value={seed} onChange={(event) => setSeed(event.target.value)} />
          </label>

          <button className="primary" onClick={() => setRunning((value) => !value)}>
            {running ? '暂停' : '开始'}
          </button>

          <button className="secondary" onClick={handleReset} style={{ marginLeft: '12px' }}>
            重置模拟
          </button>

          <label style={{ marginLeft: '16px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={showDebugOverlay}
              onChange={(event) => setShowDebugOverlay(event.target.checked)}
            />
            显示物理调试叠加层
          </label>
        </div>

        {renderMode === 'battle' && (
          <div className="control-group" style={{ marginTop: '12px' }}>
            <fieldset>
              <legend>相机控制</legend>
              <label> x <input type="number" value={battleScene.camera.x} onChange={(e) => updateCamera('x', Number(e.target.value))} /> </label>
              <label> y <input type="number" value={battleScene.camera.y} onChange={(e) => updateCamera('y', Number(e.target.value))} /> </label>
              <label> z <input type="number" value={battleScene.camera.z} onChange={(e) => updateCamera('z', Number(e.target.value))} /> </label>
              <label> focus <input type="number" min="1" value={battleScene.camera.focus} onChange={(e) => updateCamera('focus', Math.max(1, Number(e.target.value)))} /> </label>
            </fieldset>

            {renderLayerPanel('background', '背景层')}
            {renderLayerPanel('floor', '地板层')}
            {renderLayerPanel('ceiling', '天花板层')}
            {renderLayerPanel('character', '小人层')}
          </div>
        )}

        <div className="control-group record-group" style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <span style={{ marginRight: '16px', fontWeight: 'bold', color: isRecording ? '#ff4d4f' : 'inherit' }}>
            {isRecording ? `🔴 录制中: ${recordedCount} 帧` : `已就绪 (最大 10000 帧)`}
          </span>
          {!isRecording ? (
            <button className="primary" onClick={startRecording}>开始本地录制 (XML)</button>
          ) : (
            <>
              <button className="record" onClick={() => stopRecording('xml')}>停止并导出 XML</button>
              <button className="primary" onClick={() => stopRecording('json')} style={{ marginLeft: '8px' }}>
                停止并导出压缩 JSON
              </button>
            </>
          )}
        </div>
      </section>

      <p className="status">{status}</p>
    </div>
  );
}
