import {
  Assets,
  Container,
  Sprite,
  Texture,
  Spritesheet
} from 'pixi.js';
import type {
  SceneFrame,
  RenderObject,
  SpriteData,
  ParticleContainerData
} from '../types/rendering';
import { assetRegistry } from '../assets/assetRegistry';

export class PixiRenderer {
  private container: Container;
  private assetCache: Map<string, unknown> = new Map();

  constructor(container: Container) {
    this.container = container;
    this.container.sortableChildren = true;
  }

  /**
   * 渲染一帧数据
   */
  public async render(frame: SceneFrame) {
    this.container.removeChildren();
    this.container.position.set(frame.cameraX, frame.cameraY);

    const sortedObjects = [...frame.objects].sort(getObjectZIndex);

    for (const obj of sortedObjects) {
      switch (obj.type) {
        case 'sprite':
          await this.renderSprite(obj.data);
          break;
        case 'particleContainer':
          await this.renderParticleContainer(obj.data);
          break;
        default:
          break;
      }
    }
  }

  private async renderSprite(data: SpriteData) {
    try {
      const texture = await this.resolveSpriteTexture(data);
      if (texture) {
        const sprite = new Sprite(texture);
        sprite.x = data.x;
        sprite.y = data.y;
        sprite.anchor.set(data.anchorX, data.anchorY);
        sprite.scale.set(data.scaleX, data.scaleY);
        sprite.rotation = data.rotation;
        sprite.alpha = data.alpha;
        sprite.visible = data.visible;
        sprite.blendMode = data.blendMode;
        sprite.zIndex = data.zIndex;
        sprite.tint = data.tint;

        this.container.addChild(sprite);
      }
    } catch (error) {
      console.error('Failed to render sprite:', data.id, error);
      throw new Error(`SPRITE ${data.id} 渲染失败：${readErrorMessage(error)}`);
    }
  }

  private async renderParticleContainer(data: ParticleContainerData) {
    try {
      const url = assetRegistry.getUrl(data.atlas);
      const asset = await this.getAsset<Texture | Spritesheet>(url);
      if (asset) {
        const pContainer = new Container();
        pContainer.zIndex = data.zIndex;
        pContainer.blendMode = data.blendMode;

        data.particles.forEach(p => {
          let particleTexture: Texture | null = null;
          
          if (hasTextures(asset)) {
            particleTexture = asset.textures[p.frame] || null;
          }

          if (particleTexture) {
            const sprite = new Sprite(particleTexture);
            sprite.x = p.x;
            sprite.y = p.y;
            sprite.anchor.set(p.anchorX, p.anchorY);
            sprite.scale.set(p.scaleX, p.scaleY);
            sprite.rotation = p.rotation;
            sprite.alpha = p.alpha;
            sprite.tint = p.tint;
            pContainer.addChild(sprite);
          }
        });

        this.container.addChild(pContainer);
      }
    } catch (error) {
      console.error('Failed to render particle container:', data.id, error);
      throw new Error(`PARTICLECONTAINER ${data.id} 渲染失败：${readErrorMessage(error)}`);
    }
  }

  private async resolveSpriteTexture(data: SpriteData) {
    if (data.image) {
      const url = assetRegistry.getUrl(data.image);
      return this.getAsset<Texture>(url);
    }

    if (!data.atlas || !data.frame) {
      return null;
    }

    const url = assetRegistry.getUrl(data.atlas);
    const asset = await this.getAsset<Texture | Spritesheet>(url);
    if (asset && hasTextures(asset)) {
      return asset.textures[data.frame] ?? null;
    }

    return null;
  }

  private async getAsset<T>(url: string): Promise<T | null> {
    let asset = this.assetCache.get(url);
    if (!asset) {
      asset = await Assets.load(url);
      if (asset) {
        this.assetCache.set(url, asset);
      }
    }
    return (asset as T) || null;
  }
}

function getObjectZIndex(left: RenderObject, right: RenderObject) {
  return readObjectZIndex(left) - readObjectZIndex(right);
}

function readObjectZIndex(object: RenderObject) {
  if (object.type === 'sprite') {
    return object.data.zIndex;
  }
  if (object.type === 'particleContainer') {
    return object.data.zIndex;
  }

  return 0;
}

function hasTextures(asset: Texture | Spritesheet): asset is Spritesheet {
  return 'textures' in asset;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '资源加载失败';
}
