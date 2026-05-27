import { Assets, Container, Sprite, Texture, Spritesheet } from 'pixi.js';
import { assetRegistry } from '../assets/assetRegistry';
import type {
  FrameRenderParticleContainerTask,
  FrameRenderPlan,
  FrameRenderSpriteTask,
} from '../frame-data/types';

export class PixiDisplayAdapter {
  private container: Container;
  private assetCache = new Map<string, unknown>();

  constructor(container: Container) {
    this.container = container;
  }

  public async renderPlan(plan: FrameRenderPlan) {
    this.container.removeChildren();
    this.container.position.set(plan.camera.x ?? 0, plan.camera.y ?? 0);

    for (const task of plan.tasks) {
      if (task.kind === 'sprite') {
        await this.renderSpriteTask(task);
      } else {
        await this.renderParticleContainerTask(task);
      }
    }
  }

  private async renderSpriteTask(task: FrameRenderSpriteTask) {
    try {
      const texture = await this.resolveSpriteTexture(task.props);
      if (!texture) {
        return;
      }

      const sprite = new Sprite(texture);
      sprite.x = task.props.x ?? 0;
      sprite.y = task.props.y ?? 0;
      sprite.anchor.set(task.props.anchorX ?? 0, task.props.anchorY ?? 0);
      sprite.scale.set(task.props.scaleX ?? 1, task.props.scaleY ?? 1);
      sprite.rotation = task.props.rotation ?? 0;
      sprite.alpha = task.props.alpha ?? 1;
      sprite.visible = task.props.visible ?? true;
      sprite.zIndex = task.zIndex;

      if (task.props.blendMode && task.props.blendMode !== 'none') {
        sprite.blendMode = task.props.blendMode;
      }
      if (task.props.tint !== undefined) {
        sprite.tint = parseTint(task.props.tint);
      }

      this.container.addChild(sprite);
    } catch (error) {
      console.error('Failed to render sprite:', task.id, error);
      throw new Error(`SPRITE ${task.id} 渲染失败：${readErrorMessage(error)}`);
    }
  }

  private async renderParticleContainerTask(task: FrameRenderParticleContainerTask) {
    try {
      const url = assetRegistry.getUrl(task.props.atlas);
      const asset = await this.getAsset<Texture | Spritesheet>(url);
      if (!asset) {
        return;
      }

      const container = new Container();
      container.zIndex = task.zIndex;
      if (task.props.blendMode && task.props.blendMode !== 'none') {
        (container as { blendMode: string }).blendMode = task.props.blendMode;
      }

      for (const particle of task.props.particles) {
        let texture: Texture | null = null;
        if (hasTextures(asset) && particle.atlasFrame) {
          texture = asset.textures[particle.atlasFrame] || null;
        }
        if (!texture) {
          continue;
        }

        const sprite = new Sprite(texture);
        sprite.x = particle.x ?? 0;
        sprite.y = particle.y ?? 0;
        sprite.anchor.set(particle.anchorX ?? 0, particle.anchorY ?? 0);
        sprite.scale.set(particle.scaleX ?? 1, particle.scaleY ?? 1);
        sprite.rotation = particle.rotation ?? 0;
        sprite.alpha = particle.alpha ?? 1;
        if (particle.tint !== undefined) {
          sprite.tint = parseTint(particle.tint);
        }

        container.addChild(sprite);
      }

      this.container.addChild(container);
    } catch (error) {
      console.error('Failed to render particle container:', task.id, error);
      throw new Error(`PARTICLECONTAINER ${task.id} 渲染失败：${readErrorMessage(error)}`);
    }
  }

  private async resolveSpriteTexture(props: FrameRenderSpriteTask['props']) {
    if (props.image) {
      const url = assetRegistry.getUrl(props.image);
      return this.getAsset<Texture>(url);
    }

    if (!props.atlas || !props.atlasFrame) {
      return null;
    }

    const url = assetRegistry.getUrl(props.atlas);
    const asset = await this.getAsset<Texture | Spritesheet>(url);
    if (asset && hasTextures(asset)) {
      return asset.textures[props.atlasFrame] ?? null;
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

function hasTextures(asset: Texture | Spritesheet): asset is Spritesheet {
  return 'textures' in asset;
}

function parseTint(value: string | number) {
  return typeof value === 'string' ? parseInt(value, 16) : value;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '资源加载失败';
}
