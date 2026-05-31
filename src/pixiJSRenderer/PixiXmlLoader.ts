import type { 
  PixiFrameObjectState, 
  PixiFrameStateMap, 
  PixiRendererObjectKind
} from './types';

export interface LoadedCanvas {
  name: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  frames: PixiFrameStateMap[];
}

export class PixiXmlLoader {
  /**
   * 加载 XML 字符串并转换为帧序列
   */
  static load(xmlString: string): LoadedCanvas {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const canvasEl = xmlDoc.getElementsByTagName("Canvas")[0];

    if (!canvasEl) {
      throw new Error("Invalid XML: Missing <Canvas> tag");
    }

    const canvasProps = {
      name: canvasEl.getAttribute("name") || "Untitled",
      width: parseInt(canvasEl.getAttribute("width") || "1920"),
      height: parseInt(canvasEl.getAttribute("height") || "1080"),
      fps: parseInt(canvasEl.getAttribute("fps") || "30"),
      totalFrames: parseInt(canvasEl.getAttribute("totalFrames") || "0")
    };

    // 初始化所有帧的 Map
    const frames: PixiFrameStateMap[] = Array.from(
      { length: canvasProps.totalFrames }, 
      () => new Map()
    );

    // 解析所有顶级实体
    this.parseEntities(canvasEl, frames);

    return { ...canvasProps, frames };
  }

  private static parseEntities(parentEl: Element, frames: PixiFrameStateMap[], containerId?: string) {
    const children = Array.from(parentEl.children);

    children.forEach(entityEl => {
      const tagName = entityEl.tagName;
      if (tagName === 'KEYFRAME') return; // 跳过关键帧标签，它们由实体处理

      const id = entityEl.getAttribute("id")!;
      const kind = (entityEl.getAttribute("kind") || this.mapTagToKind(tagName)) as PixiRendererObjectKind;
      
      // 获取该实体的所有关键帧并按帧号排序
      const keyframeEls = Array.from(entityEl.children)
        .filter(child => child.tagName === 'KEYFRAME')
        .sort((a, b) => parseInt(a.getAttribute("frame")!) - parseInt(b.getAttribute("frame")!));

      if (keyframeEls.length === 0) return;

      let currentState: any = null;
      let nextKeyframeIdx = 0;

      // 遍历每一帧，应用继承逻辑
      for (let f = 0; f < frames.length; f++) {
        const kfEl = keyframeEls[nextKeyframeIdx];
        const kfFrame = kfEl ? parseInt(kfEl.getAttribute("frame")!) : -1;

        if (f === kfFrame) {
          // 命中关键帧
          const isActive = kfEl.getAttribute("active") !== "false";
          
          if (!isActive) {
            currentState = null; // 标记为销毁
          } else {
            // 更新当前状态（继承 + 覆盖）
            const newProps = this.xmlAttrsToProps(kfEl);
            currentState = currentState ? { ...currentState, ...newProps } : newProps;
          }
          nextKeyframeIdx++;
        }

        // 如果当前实体处于存活状态，将其存入该帧的 Map
        if (currentState) {
          const objectState: PixiFrameObjectState = {
            id,
            kind,
            props: this.reconstructProps(kind, currentState)
          } as any;

          if (kind === 'particle' && containerId) {
            (objectState as any).containerId = containerId;
          }

          frames[f].set(id, objectState);
        }
      }

      // 如果是粒子容器，递归解析内部的粒子
      if (tagName === 'PARTICLECONTAINER') {
        this.parseEntities(entityEl, frames, id);
      }
    });
  }

  private static mapTagToKind(tagName: string): string {
    switch (tagName) {
      case 'CAMERA': return 'camera';
      case 'SPRITE': return 'sprite';
      case 'PARTICLECONTAINER': return 'particleContainer';
      case 'PARTICLE': return 'particle';
      case 'GRAPHIC': return 'rectangleGraphic'; // 默认，通常会有 kind 覆盖
      default: return 'sprite';
    }
  }

  private static xmlAttrsToProps(el: Element): any {
    const props: any = {};
    Array.from(el.attributes).forEach(attr => {
      if (attr.name === 'frame' || attr.name === 'active') return;
      
      const val = attr.value;
      // 尝试转换数值
      if (/^-?\d+(\.\d+)?$/.test(val)) {
        props[attr.name] = parseFloat(val);
      } else if (val === 'true' || val === 'false') {
        props[attr.name] = val === 'true';
      } else {
        props[attr.name] = val;
      }
    });
    return props;
  }

  /**
   * 将平铺的 XML 属性重构为 types.ts 中的嵌套对象结构
   */
  private static reconstructProps(kind: string, rawProps: any): any {
    const props = { ...rawProps };

    // 1. 重构纹理 (Texture)
    if (kind === 'sprite' || kind === 'particle') {
      if (props.image) {
        props.texture = { kind: 'image', image: props.image };
        delete props.image;
      } else if (props.atlas && props.atlasFrame) {
        props.texture = { kind: 'atlasFrame', atlas: props.atlas, atlasFrame: props.atlasFrame };
        delete props.atlas;
        delete props.atlasFrame;
      }
    }

    // 2. 重构描边和填充 (Stroke & Fill)
    if (kind.endsWith('Graphic')) {
      if (props.strokeColor !== undefined || props.strokeAlpha !== undefined || props.strokeWidth !== undefined) {
        props.stroke = {
          color: props.strokeColor,
          alpha: props.strokeAlpha ?? 1,
          width: props.strokeWidth ?? 1
        };
        delete props.strokeColor;
        delete props.strokeAlpha;
        delete props.strokeWidth;
      }
      if (props.fillColor !== undefined || props.fillAlpha !== undefined) {
        props.fill = {
          color: props.fillColor,
          alpha: props.fillAlpha ?? 1
        };
        delete props.fillColor;
        delete props.fillAlpha;
      }

      // 重构多边形点位
      if (kind === 'polygonGraphic' && typeof props.points === 'string') {
        props.points = props.points.split(' ').map((pair: string) => {
          const [x, y] = pair.split(',').map(Number);
          return { x, y };
        });
      }

      // 重构直线点位
      if (kind === 'lineGraphic') {
        if (props.startX !== undefined && props.startY !== undefined) {
          props.start = { x: props.startX, y: props.startY };
          delete props.startX;
          delete props.startY;
        }
        if (props.endX !== undefined && props.endY !== undefined) {
          props.end = { x: props.endX, y: props.endY };
          delete props.endX;
          delete props.endY;
        }
      }

      // 重构贝塞尔路径
      if (kind === 'bezierCurveGraphic' && typeof props.path === 'string') {
        try {
          props.path = JSON.parse(props.path);
        } catch (error) {
          console.warn('Invalid bezier path in XML:', props.path, error);
          props.path = [];
        }
      }
    }

    return props;
  }
}
