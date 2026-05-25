import { 
  Container, 
  Sprite, 
  Text, 
  TextStyle, 
  Assets, 
  Texture,
  Spritesheet
} from 'pixi.js';
import type { ColorSource, BLEND_MODES } from 'pixi.js';
import type { 
  SceneFrame, 
  TextData, 
  SpriteData, 
  ParticleContainerData 
} from '../types/rendering';
import { assetRegistry } from '../utils/assetRegistry';

export class PixiRenderer {
  private container: Container;
  private assetCache: Map<string, any> = new Map();

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * 渲染一帧数据
   */
  public async render(frame: SceneFrame) {
    this.container.removeChildren();

    const renderPromises = frame.objects.map(obj => {
      switch (obj.type) {
        case 'text':
          return this.renderText(obj.data);
        case 'sprite':
          return this.renderSprite(obj.data);
        case 'particleContainer':
          return this.renderParticleContainer(obj.data);
        default:
          return Promise.resolve();
      }
    });

    await Promise.all(renderPromises);
  }

  private async renderText(data: TextData) {
    const style = new TextStyle({
      fontFamily: data.style?.fontFamily || 'Inter, sans-serif',
      fontSize: data.style?.fontSize || 24,
      fill: (data.style?.fill as ColorSource) || '#eef4ff',
      align: data.style?.align || 'left',
      fontWeight: (data.style?.fontWeight as any) || 'normal',
      stroke: data.style?.stroke ? {
        color: (data.style.stroke as ColorSource),
        width: data.style.strokeThickness || 0,
      } : undefined,
      dropShadow: data.style?.dropShadow ? {
        color: (data.style.dropShadowColor as ColorSource),
      } : undefined,
      wordWrap: data.style?.wordWrap,
      wordWrapWidth: data.style?.wordWrapWidth,
    });

    const pixiText = new Text({
      text: data.text,
      style,
    });

    pixiText.x = data.x;
    pixiText.y = data.y;
    pixiText.alpha = data.alpha ?? 1;
    pixiText.rotation = data.rotation ?? 0;
    
    if (data.anchor) {
      pixiText.anchor.set(data.anchor.x, data.anchor.y);
    }
    if (data.scale) {
      pixiText.scale.set(data.scale.x, data.scale.y);
    }
    if (data.visible !== undefined) {
      pixiText.visible = data.visible;
    }

    this.container.addChild(pixiText);
  }

  private async renderSprite(data: SpriteData) {
    try {
      const url = assetRegistry.getUrl(data.assetUrl);
      const texture = await this.getAsset<Texture>(url);
      if (texture) {
        const sprite = new Sprite(texture);
        sprite.x = data.x;
        sprite.y = data.y;
        sprite.alpha = data.alpha ?? 1;
        sprite.rotation = data.rotation ?? 0;
        
        if (data.tint !== undefined) sprite.tint = data.tint;
        if (data.width) sprite.width = data.width;
        if (data.height) sprite.height = data.height;
        if (data.anchor) sprite.anchor.set(data.anchor.x, data.anchor.y);
        if (data.scale) sprite.scale.set(data.scale.x, data.scale.y);
        if (data.visible !== undefined) sprite.visible = data.visible;
        if (data.blendMode) sprite.blendMode = data.blendMode as BLEND_MODES;

        this.container.addChild(sprite);
      }
    } catch (error) {
      console.error('Failed to render sprite:', data.assetUrl, error);
    }
  }

  private async renderParticleContainer(data: ParticleContainerData) {
    try {
      const url = assetRegistry.getUrl(data.assetUrl);
      const asset = await this.getAsset<Texture | Spritesheet>(url);
      if (asset) {
        const pContainer = new Container();
        const isSpritesheet = asset instanceof Spritesheet;

        data.particles.forEach(p => {
          let particleTexture: Texture | null = null;
          
          if (isSpritesheet && p.frame !== undefined) {
            particleTexture = asset.textures[p.frame] || null;
          } else if (asset instanceof Texture) {
            particleTexture = asset;
          }

          if (particleTexture) {
            const sprite = new Sprite(particleTexture);
            sprite.x = p.x;
            sprite.y = p.y;
            if (p.scale !== undefined) sprite.scale.set(p.scale);
            if (p.rotation !== undefined) sprite.rotation = p.rotation;
            if (p.alpha !== undefined) sprite.alpha = p.alpha;
            if (p.tint !== undefined) sprite.tint = p.tint;
            pContainer.addChild(sprite);
          }
        });

        this.container.addChild(pContainer);
      }
    } catch (error) {
      console.error('Failed to render particle container:', data.assetUrl, error);
    }
  }

  private async getAsset<T>(url: string): Promise<T | null> {
    let asset = this.assetCache.get(url);
    if (!asset) {
      asset = await Assets.load(url);
      if (asset) {
        this.assetCache.set(url, asset);
      }
    }
    return asset || null;
  }
}
