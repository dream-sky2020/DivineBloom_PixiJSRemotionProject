import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Divider, InputNumber, Segmented, Space, Typography } from 'antd';
import { Application, Assets, Graphics, Sprite, Texture } from 'pixi.js';

const { Text } = Typography;

type PreviewMode = 'image' | 'pixi';

interface ImageViewContentProps {
  url: string;
  title?: string;
  initialScale?: number;
  initialAnchorX?: number;
  initialAnchorY?: number;
  onSaveDefaults?: (next: {
    defaultScale: number;
    defaultAnchorX: number;
    defaultAnchorY: number;
  }) => Promise<void> | void;
}

export const ImageViewContent: React.FC<ImageViewContentProps> = ({
  url,
  title,
  initialScale = 1,
  initialAnchorX = 0.5,
  initialAnchorY = 0.5,
  onSaveDefaults,
}) => {
  const [previewMode, setPreviewMode] = useState<PreviewMode>('image');
  const [defaultScale, setDefaultScale] = useState(initialScale);
  const [defaultAnchorX, setDefaultAnchorX] = useState(initialAnchorX);
  const [defaultAnchorY, setDefaultAnchorY] = useState(initialAnchorY);
  const [canvasWidth, setCanvasWidth] = useState(960);
  const [canvasHeight, setCanvasHeight] = useState(540);
  const [previewHint, setPreviewHint] = useState('提示：切换到 Pixi 预览模式可查看 anchor 点效果');
  const [saving, setSaving] = useState(false);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const spriteRef = useRef<Sprite | null>(null);
  const anchorMarkerRef = useRef<Graphics | null>(null);
  const boundsRef = useRef<Graphics | null>(null);

  useEffect(() => {
    setDefaultScale(initialScale);
    setDefaultAnchorX(initialAnchorX);
    setDefaultAnchorY(initialAnchorY);
  }, [initialScale, initialAnchorX, initialAnchorY, url]);

  useEffect(() => {
    if (previewMode !== 'pixi') {
      destroyPixiPreview();
      return;
    }

    let disposed = false;
    const init = async () => {
      const host = hostRef.current;
      if (!host) return;

      const app = new Application();
      await app.init({
        width: canvasWidth,
        height: canvasHeight,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        backgroundColor: readThemeColor('--dark-navy'),
      });

      if (disposed) {
        app.destroy(true, { children: true, texture: true });
        return;
      }

      host.innerHTML = '';
      host.appendChild(app.canvas);
      appRef.current = app;

      const sprite = new Sprite(Texture.EMPTY);
      spriteRef.current = sprite;
      app.stage.addChild(sprite);

      const marker = new Graphics();
      anchorMarkerRef.current = marker;
      app.stage.addChild(marker);

      const bounds = new Graphics();
      boundsRef.current = bounds;
      app.stage.addChild(bounds);

      try {
        const textureAsset = await Assets.load(encodeURI(url));
        if (disposed || !appRef.current || appRef.current !== app) return;
        if (textureAsset instanceof Texture) {
          sprite.texture = textureAsset;
        }
      } catch (error) {
        setPreviewHint(`贴图加载失败：${error instanceof Error ? error.message : '未知错误'}`);
      }

      updatePixiPreviewTransform();
    };

    void init();
    return () => {
      disposed = true;
      destroyPixiPreview();
    };
  }, [previewMode, url, canvasWidth, canvasHeight]);

  useEffect(() => {
    if (previewMode === 'pixi') {
      updatePixiPreviewTransform();
    }
  }, [previewMode, defaultScale, defaultAnchorX, defaultAnchorY, canvasWidth, canvasHeight]);

  const handleSave = async () => {
    if (!onSaveDefaults) return;
    setSaving(true);
    try {
      await onSaveDefaults({
        defaultScale,
        defaultAnchorX,
        defaultAnchorY,
      });
      setPreviewHint('已保存默认缩放与锚点参数');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '12px 0',
      }}
    >
      <Space wrap>
        <Text strong>{title ?? '图片预览'}</Text>
        <Segmented<PreviewMode>
          value={previewMode}
          onChange={(value) => setPreviewMode(value)}
          options={[
            { label: '原图预览', value: 'image' },
            { label: 'Pixi 画布预览', value: 'pixi' },
          ]}
        />
      </Space>

      <Space wrap>
        <label>
          默认缩放
          <InputNumber
            min={0.01}
            max={100}
            step={0.01}
            value={defaultScale}
            onChange={(value) => setDefaultScale(Math.max(0.01, Number(value ?? 1)))}
            style={{ marginLeft: 8, width: 120 }}
          />
        </label>
        <label>
          Anchor X
          <InputNumber
            min={0}
            max={1}
            step={0.01}
            value={defaultAnchorX}
            onChange={(value) => setDefaultAnchorX(clampAnchor(Number(value ?? 0.5)))}
            style={{ marginLeft: 8, width: 120 }}
          />
        </label>
        <label>
          Anchor Y
          <InputNumber
            min={0}
            max={1}
            step={0.01}
            value={defaultAnchorY}
            onChange={(value) => setDefaultAnchorY(clampAnchor(Number(value ?? 0.5)))}
            style={{ marginLeft: 8, width: 120 }}
          />
        </label>
        <Button type="primary" onClick={() => void handleSave()} loading={saving} disabled={!onSaveDefaults}>
          保存默认参数
        </Button>
      </Space>

      {previewMode === 'pixi' && (
        <Space wrap>
          <label>
            画布宽
            <InputNumber
              min={64}
              max={3840}
              step={1}
              value={canvasWidth}
              onChange={(value) => setCanvasWidth(Math.max(64, Number(value ?? 960)))}
              style={{ marginLeft: 8, width: 120 }}
            />
          </label>
          <label>
            画布高
            <InputNumber
              min={64}
              max={2160}
              step={1}
              value={canvasHeight}
              onChange={(value) => setCanvasHeight(Math.max(64, Number(value ?? 540)))}
              style={{ marginLeft: 8, width: 120 }}
            />
          </label>
        </Space>
      )}

      <Divider style={{ margin: '8px 0' }} />

      {previewMode === 'image' ? (
        <div
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            overflow: 'auto',
            borderRadius: '8px',
            background: 'var(--dark-navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
          }}
        >
          <img
            src={url}
            alt={title || 'Preview'}
            style={{
              maxWidth: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
        </div>
      ) : (
        <div
          ref={hostRef}
          style={{
            width: canvasWidth,
            height: canvasHeight,
            maxWidth: '100%',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid var(--transparent-white-12)',
          }}
        />
      )}

      <Alert showIcon type="info" message={previewHint} />
      <Text type="secondary" style={{ fontSize: 12 }}>
        {url}
      </Text>
    </div>
  );

  function updatePixiPreviewTransform() {
    const app = appRef.current;
    const sprite = spriteRef.current;
    const marker = anchorMarkerRef.current;
    const bounds = boundsRef.current;
    if (!app || !sprite || !marker || !bounds) return;

    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    sprite.position.set(centerX, centerY);
    sprite.anchor.set(defaultAnchorX, defaultAnchorY);
    sprite.scale.set(defaultScale, defaultScale);

    const anchorDotColor = readThemeColor('--cyan');
    const anchorCrossColor = readThemeColor('--yellow');
    const boundsColor = readThemeColor('--blue');

    marker.clear();
    marker.circle(centerX, centerY, 5);
    marker.fill(anchorDotColor);
    marker.moveTo(centerX - 12, centerY);
    marker.lineTo(centerX + 12, centerY);
    marker.moveTo(centerX, centerY - 12);
    marker.lineTo(centerX, centerY + 12);
    marker.stroke({ width: 2, color: anchorCrossColor, alpha: 1 });

    bounds.clear();
    const spriteBounds = sprite.getBounds();
    bounds.rect(spriteBounds.x, spriteBounds.y, spriteBounds.width, spriteBounds.height);
    bounds.stroke({ width: 1, color: boundsColor, alpha: 0.9 });

    setPreviewHint('Pixi 预览模式：十字点为锚点落位，矩形线为精灵当前包围盒');
  }

  function destroyPixiPreview() {
    if (appRef.current) {
      appRef.current.destroy(true, { children: true, texture: true });
    }
    appRef.current = null;
    spriteRef.current = null;
    anchorMarkerRef.current = null;
    boundsRef.current = null;
    if (hostRef.current) {
      hostRef.current.innerHTML = '';
    }
  }
};

function clampAnchor(value: number) {
  return Math.max(0, Math.min(1, value));
}

function readThemeColor(variableName: string) {
  if (typeof window === 'undefined') {
    return 0;
  }
  const raw = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  if (!raw) {
    return 0;
  }
  if (raw.startsWith('#')) {
    return Number.parseInt(raw.slice(1), 16);
  }
  const rgbMatch = raw.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return (Number(r) << 16) + (Number(g) << 8) + Number(b);
  }
  return 0;
}
