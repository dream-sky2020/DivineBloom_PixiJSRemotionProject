import type { 
  PixiReadonlyFrameStateMap, 
  PixiFrameObjectState, 
  PixiRendererObjectId,
  PixiSpriteProps,
  PixiGraphicDisplayProps,
  PixiRectangleGraphicProps,
  PixiCircleGraphicProps,
  PixiPolygonGraphicProps,
  PixiParticleProps,
  PixiCameraProps,
  PixiParticleContainerProps
} from './types';

interface CanvasExportProps {
  name: string;
  width: number;
  height: number;
  fps: number;
}

/**
 * PixiXmlExporter: 将连续的帧数据导出为符合 xml_data_structures.txt 规范的 XML 字符串
 */
export class PixiXmlExporter {
  /**
   * 导出 XML
   * @param frames 帧状态数组
   * @param canvasProps 画布基础属性
   */
  static export(frames: PixiReadonlyFrameStateMap[], canvasProps: CanvasExportProps): string {
    const totalFrames = frames.length;
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<Canvas name="${canvasProps.name}" width="${canvasProps.width}" height="${canvasProps.height}" fps="${canvasProps.fps}" totalFrames="${totalFrames}">\n`;

    // 1. 收集所有出现过的对象 ID 及其类型
    const allObjectIds = new Set<PixiRendererObjectId>();
    const objectKinds = new Map<PixiRendererObjectId, string>();
    const particleToContainer = new Map<PixiRendererObjectId, PixiRendererObjectId>();

    frames.forEach(frame => {
      frame.forEach((state, id) => {
        allObjectIds.add(id);
        objectKinds.set(id, state.kind);
        if (state.kind === 'particle') {
          particleToContainer.set(id, state.containerId);
        }
      });
    });

    // 2. 分类对象：相机、普通对象（Sprite, Graphic, ParticleContainer）、粒子
    const cameras: PixiRendererObjectId[] = [];
    const standaloneObjects: PixiRendererObjectId[] = [];
    const particlesByContainer = new Map<PixiRendererObjectId, PixiRendererObjectId[]>();

    allObjectIds.forEach(id => {
      const kind = objectKinds.get(id)!;
      if (kind === 'camera') {
        cameras.push(id);
      } else if (kind === 'particle') {
        const containerId = particleToContainer.get(id)!;
        if (!particlesByContainer.has(containerId)) {
          particlesByContainer.set(containerId, []);
        }
        particlesByContainer.get(containerId)!.push(id);
      } else {
        standaloneObjects.push(id);
      }
    });

    // 3. 渲染相机
    cameras.forEach(id => {
      xml += this.renderObjectXml('CAMERA', id, frames);
    });

    // 4. 渲染独立对象（Sprite, Graphic, ParticleContainer）
    standaloneObjects.forEach(id => {
      const kind = objectKinds.get(id)!;
      let tagName = 'SPRITE';
      let extraAttrs = '';

      if (kind.endsWith('Graphic')) {
        tagName = 'GRAPHIC';
        extraAttrs = ` kind="${kind}"`;
      } else if (kind === 'particleContainer') {
        tagName = 'PARTICLECONTAINER';
      }

      xml += `    <${tagName} id="${id}"${extraAttrs}>\n`;
      
      // 渲染该对象的关键帧
      xml += this.renderKeyframes(id, frames, '      ');

      // 如果是粒子容器，渲染其内部的粒子
      if (kind === 'particleContainer') {
        const containerParticles = particlesByContainer.get(id) || [];
        containerParticles.forEach(pId => {
          xml += `        <PARTICLE id="${pId}">\n`;
          xml += this.renderKeyframes(pId, frames, '          ');
          xml += `        </PARTICLE>\n`;
        });
      }

      xml += `    </${tagName}>\n`;
    });

    xml += `</Canvas>`;
    return xml;
  }

  private static renderObjectXml(tagName: string, id: PixiRendererObjectId, frames: PixiReadonlyFrameStateMap[]): string {
    let res = `    <${tagName} id="${id}">\n`;
    res += this.renderKeyframes(id, frames, '      ');
    res += `    </${tagName}>\n`;
    return res;
  }

  private static renderKeyframes(id: PixiRendererObjectId, frames: PixiReadonlyFrameStateMap[], indent: string): string {
    let res = '';
    let lastProps: any = null;
    let isAlive = false;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const state = frame.get(id);

      if (state) {
        const currentProps = this.extractProps(state);
        
        if (!isAlive) {
          // 刚出生，必须输出所有属性
          res += `${indent}<KEYFRAME frame="${i}"${this.propsToXmlAttrs(currentProps)} />\n`;
          isAlive = true;
          lastProps = { ...currentProps };
        } else {
          // 已存在，只输出变化的属性
          const diff = this.getDiff(lastProps, currentProps);
          if (Object.keys(diff).length > 0) {
            res += `${indent}<KEYFRAME frame="${i}"${this.propsToXmlAttrs(diff)} />\n`;
            lastProps = { ...lastProps, ...diff };
          }
        }
      } else {
        if (isAlive) {
          // 刚消失
          res += `${indent}<KEYFRAME frame="${i}" active="false" />\n`;
          isAlive = false;
          lastProps = null;
        }
      }
    }
    return res;
  }

  private static extractProps(state: PixiFrameObjectState): any {
    const props: any = { ...state.props };
    
    // 特殊处理纹理
    if (state.kind === 'sprite' && (state.props as PixiSpriteProps).texture) {
      const tex = (state.props as PixiSpriteProps).texture!;
      if (tex.kind === 'image') {
        props.image = tex.image;
      } else {
        props.atlas = tex.atlas;
        props.atlasFrame = tex.atlasFrame;
      }
      delete props.texture;
    }

    // 特殊处理矢量图形的描边和填充
    if (state.kind.endsWith('Graphic')) {
      const gProps = state.props as PixiGraphicDisplayProps;
      if (gProps.stroke) {
        props.strokeColor = gProps.stroke.color;
        props.strokeAlpha = gProps.stroke.alpha;
        props.strokeWidth = gProps.stroke.width;
        delete props.stroke;
      }
      if (gProps.fill) {
        props.fillColor = gProps.fill.color;
        props.fillAlpha = gProps.fill.alpha;
        delete props.fill;
      }
      
      // 多边形点位
      if (state.kind === 'polygonGraphic') {
        const pProps = state.props as PixiPolygonGraphicProps;
        props.points = pProps.points.map(p => `${p.x},${p.y}`).join(' ');
      }

      // 贝塞尔曲线路径
      if (state.kind === 'bezierCurveGraphic') {
        const bProps = state.props as any;
        if (bProps.path) {
          props.path = JSON.stringify(bProps.path).replace(/"/g, '&quot;');
        }
      }
    }

    return props;
  }

  private static getDiff(oldProps: any, newProps: any): any {
    const diff: any = {};
    for (const key in newProps) {
      // 深度比较简单对象（如 path）
      const newVal = newProps[key];
      const oldVal = oldProps[key];
      
      if (typeof newVal === 'object' && newVal !== null) {
        if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
          diff[key] = newVal;
        }
      } else if (newVal !== oldVal) {
        diff[key] = newVal;
      }
    }
    return diff;
  }

  private static propsToXmlAttrs(props: any): string {
    let attrs = '';
    for (const key in props) {
      let val = props[key];
      if (val === undefined || val === null) continue;
      
      // 格式化数值，避免过长的小数
      if (typeof val === 'number') {
        val = Math.round(val * 1000) / 1000;
      }
      
      attrs += ` ${key}="${val}"`;
    }
    return attrs;
  }
}
