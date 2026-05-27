import {
  Application,
  Assets,
  Container,
  Graphics,
  ParticleContainer,
  Sprite,
  Spritesheet,
  Texture,
  Color,
} from 'pixi.js';
import type {
  PixiBezierCurveGraphicPoolEntry,
  PixiBezierCurveGraphicProps,
  PixiCircleGraphicPoolEntry,
  PixiCircleGraphicProps,
  PixiCameraProps,
  PixiCreateCommand,
  PixiDestroyCommand,
  PixiEllipseGraphicPoolEntry,
  PixiEllipseGraphicProps,
  PixiGraphicDisplayProps,
  PixiGraphicPoolEntry,
  PixiLineGraphicPoolEntry,
  PixiLineGraphicProps,
  PixiParticleContainerPoolEntry,
  PixiParticleContainerProps,
  PixiParticlePoolEntry,
  PixiParticleProps,
  PixiPolygonGraphicPoolEntry,
  PixiPolygonGraphicProps,
  PixiPoolBucket,
  PixiRectangleGraphicPoolEntry,
  PixiRectangleGraphicProps,
  PixiRendererCommand,
  PixiRendererObjectId,
  PixiRendererObjectPool,
  PixiSpritePoolEntry,
  PixiSpriteProps,
  PixiSquareGraphicPoolEntry,
  PixiSquareGraphicProps,
  PixiTextureSource,
  PixiUpdateCommand,
} from './types';

type TextureAsset = Texture | Spritesheet;
type DisplayObjectWithBlendMode = {
  blendMode?: string;
};

export class PixiCommandProcessor {
  private readonly stage: Container;
  private readonly world: Container;
  private readonly textureAssetCache = new Map<string, Promise<TextureAsset>>();
  private readonly pool: PixiRendererObjectPool = {
    sprites: createPoolBucket<PixiSpritePoolEntry, Sprite>(),
    particleContainers: createPoolBucket<PixiParticleContainerPoolEntry, ParticleContainer>(),
    particleSprites: createPoolBucket<PixiParticlePoolEntry, Sprite>(),
    graphics: createPoolBucket<PixiGraphicPoolEntry, Graphics>(),
  };

  constructor(app: Application) {
    this.stage = app.stage;
    this.stage.sortableChildren = true;
    this.world = new Container();
    this.world.sortableChildren = true;
    this.stage.addChild(this.world);
  }

  public processCommands(commands: PixiRendererCommand[]) {
    for (const command of commands) {
      if (command.type === 'create') {
        this.createObject(command);
      } else if (command.type === 'update') {
        this.updateObject(command);
      } else {
        this.destroyObject(command);
      }
    }
  }

  public getObjectPool() {
    return this.pool;
  }

  public clear() {
    if (this.pool.camera) {
      applyCameraProps(this.pool.camera.instance, {});
      this.pool.camera = undefined;
    }

    for (const id of [...this.pool.sprites.active.keys()]) {
      this.destroySprite(id);
    }
    for (const id of [...this.pool.particleContainers.active.keys()]) {
      this.destroyParticleContainer(id, true);
    }
    for (const id of [...this.pool.graphics.active.keys()]) {
      this.destroyGraphic(id);
    }
  }

  public destroy() {
    this.clear();
    destroyIdleObjects(this.pool.sprites, (sprite) => sprite.destroy({ texture: true }));
    destroyIdleObjects(this.pool.particleSprites, (sprite) => sprite.destroy({ texture: true }));
    destroyIdleObjects(this.pool.particleContainers, (container) => container.destroy({ children: true }));
    destroyIdleObjects(this.pool.graphics, (graphics) => graphics.destroy({ texture: true }));

    this.world.destroy({ children: true });

    for (const url of this.textureAssetCache.keys()) {
      void Assets.unload(url);
    }
    this.textureAssetCache.clear();
  }

  private createObject(command: PixiCreateCommand) {
    if (command.kind === 'camera') {
      this.createCamera(command.id, command.props);
      return;
    }
    if (command.kind === 'sprite') {
      this.createSprite(command.id, command.props);
      return;
    }
    if (command.kind === 'particleContainer') {
      this.createParticleContainer(command.id, command.props);
      return;
    }
    if (command.kind === 'particle') {
      this.createParticle(command.id, command.containerId, command.props);
      return;
    }

    this.createGraphic(command);
  }

  private updateObject(command: PixiUpdateCommand) {
    if (command.kind === 'camera') {
      const entry = this.pool.camera;
      if (!entry || entry.id !== command.id) {
        return;
      }
      entry.props = { ...entry.props, ...command.props };
      applyCameraProps(entry.instance, entry.props);
      return;
    }
    if (command.kind === 'sprite') {
      const entry = this.pool.sprites.active.get(command.id);
      if (!entry) {
        return;
      }
      entry.props = { ...entry.props, ...command.props };
      this.applySpriteProps(entry);
      return;
    }
    if (command.kind === 'particleContainer') {
      const entry = this.pool.particleContainers.active.get(command.id);
      if (!entry) {
        return;
      }
      entry.props = { ...entry.props, ...command.props };
      this.applyParticleContainerProps(entry);
      return;
    }
    if (command.kind === 'particle') {
      const container = this.pool.particleContainers.active.get(command.containerId);
      const entry = container?.particles.get(command.id);
      if (!entry) {
        return;
      }
      entry.props = { ...entry.props, ...command.props };
      this.applyParticleProps(entry);
      return;
    }

    const entry = this.pool.graphics.active.get(command.id);
    if (!entry || entry.kind !== command.kind) {
      return;
    }
    entry.props = { ...entry.props, ...command.props } as PixiGraphicPoolEntry['props'];
    this.redrawGraphic(entry);
  }

  private destroyObject(command: PixiDestroyCommand) {
    if (command.kind === 'camera') {
      if (this.pool.camera?.id === command.id) {
        applyCameraProps(this.pool.camera.instance, {});
        this.pool.camera = undefined;
      }
      return;
    }
    if (command.kind === 'sprite') {
      this.destroySprite(command.id);
      return;
    }
    if (command.kind === 'particleContainer') {
      this.destroyParticleContainer(command.id, command.destroyParticles ?? true);
      return;
    }
    if (command.kind === 'particle') {
      this.destroyParticle(command.containerId, command.id);
      return;
    }

    this.destroyGraphic(command.id);
  }

  private createCamera(id: PixiRendererObjectId, props: PixiCameraProps) {
    this.pool.camera = {
      id,
      kind: 'camera',
      instance: this.world,
      props,
    };
    applyCameraProps(this.world, props);
  }

  private createSprite(id: PixiRendererObjectId, props: PixiSpriteProps) {
    const oldEntry = this.pool.sprites.active.get(id);
    if (oldEntry) {
      oldEntry.props = props;
      this.applySpriteProps(oldEntry);
      return;
    }

    const sprite = this.pool.sprites.idle.pop() ?? new Sprite(Texture.EMPTY);
    const entry: PixiSpritePoolEntry = {
      id,
      kind: 'sprite',
      instance: sprite,
      props,
    };
    this.pool.sprites.active.set(id, entry);
    this.world.addChild(sprite);
    this.applySpriteProps(entry);
  }

  private createParticleContainer(id: PixiRendererObjectId, props: PixiParticleContainerProps) {
    const oldEntry = this.pool.particleContainers.active.get(id);
    if (oldEntry) {
      oldEntry.props = props;
      this.applyParticleContainerProps(oldEntry);
      return;
    }

    const container = this.pool.particleContainers.idle.pop() ?? new ParticleContainer();
    const entry: PixiParticleContainerPoolEntry = {
      id,
      kind: 'particleContainer',
      instance: container,
      props,
      particles: new Map(),
    };
    this.pool.particleContainers.active.set(id, entry);
    this.world.addChild(container);
    this.applyParticleContainerProps(entry);
  }

  private createParticle(
    id: PixiRendererObjectId,
    containerId: PixiRendererObjectId,
    props: PixiParticleProps,
  ) {
    const container = this.pool.particleContainers.active.get(containerId);
    if (!container) {
      return;
    }

    const oldEntry = container.particles.get(id);
    if (oldEntry) {
      oldEntry.props = props;
      this.applyParticleProps(oldEntry);
      return;
    }

    const sprite = this.pool.particleSprites.idle.pop() ?? new Sprite(Texture.EMPTY);
    const entry: PixiParticlePoolEntry = {
      id,
      kind: 'particle',
      containerId,
      instance: sprite,
      props,
    };
    container.particles.set(id, entry);
    container.instance.addChild(sprite);
    this.applyParticleProps(entry);
  }

  private createGraphic(command: Exclude<PixiCreateCommand, { kind: 'camera' | 'sprite' | 'particleContainer' | 'particle' }>) {
    const oldEntry = this.pool.graphics.active.get(command.id);
    if (oldEntry) {
      oldEntry.props = command.props;
      this.redrawGraphic(oldEntry);
      return;
    }

    const graphics = this.pool.graphics.idle.pop() ?? new Graphics();
    const entry = createGraphicEntry(command.id, command.kind, graphics, command.props);
    this.pool.graphics.active.set(command.id, entry);
    this.world.addChild(graphics);
    this.redrawGraphic(entry);
  }

  private destroySprite(id: PixiRendererObjectId) {
    const entry = this.pool.sprites.active.get(id);
    if (!entry) {
      return;
    }
    this.pool.sprites.active.delete(id);
    entry.instance.removeFromParent();
    entry.instance.texture = Texture.EMPTY;
    this.pool.sprites.idle.push(entry.instance);
  }

  private destroyParticleContainer(id: PixiRendererObjectId, destroyParticles: boolean) {
    const entry = this.pool.particleContainers.active.get(id);
    if (!entry) {
      return;
    }

    if (destroyParticles) {
      for (const particleId of [...entry.particles.keys()]) {
        this.destroyParticle(id, particleId);
      }
    } else {
      entry.instance.removeChildren();
      entry.particles.clear();
    }

    this.pool.particleContainers.active.delete(id);
    entry.instance.removeFromParent();
    resetDisplayObject(entry.instance);
    this.pool.particleContainers.idle.push(entry.instance);
  }

  private destroyParticle(containerId: PixiRendererObjectId, id: PixiRendererObjectId) {
    const container = this.pool.particleContainers.active.get(containerId);
    const entry = container?.particles.get(id);
    if (!container || !entry) {
      return;
    }

    container.particles.delete(id);
    entry.instance.removeFromParent();
    entry.instance.texture = Texture.EMPTY;
    this.pool.particleSprites.idle.push(entry.instance);
  }

  private destroyGraphic(id: PixiRendererObjectId) {
    const entry = this.pool.graphics.active.get(id);
    if (!entry) {
      return;
    }

    this.pool.graphics.active.delete(id);
    entry.instance.removeFromParent();
    entry.instance.clear();
    resetDisplayObject(entry.instance);
    this.pool.graphics.idle.push(entry.instance);
  }

  private applySpriteProps(entry: PixiSpritePoolEntry) {
    const { instance, props } = entry;
    if (props.texture) {
      this.applyTexture(props.texture, (texture) => {
        if (
          this.pool.sprites.active.get(entry.id) === entry &&
          entry.props.texture === props.texture
        ) {
          entry.texture = texture;
          instance.texture = texture;
        }
      });
    }

    instance.x = props.x ?? 0;
    instance.y = props.y ?? 0;
    instance.anchor.set(props.anchorX ?? 0, props.anchorY ?? 0);
    instance.scale.set(props.scaleX ?? 1, props.scaleY ?? 1);
    instance.rotation = props.rotation ?? 0;
    instance.alpha = props.alpha ?? 1;
    instance.visible = props.visible ?? true;
    instance.zIndex = props.zIndex ?? 0;
    applyBlendMode(instance, props.blendMode);
    if (props.tint !== undefined) {
      instance.tint = parseColor(props.tint);
    }
  }

  private applyParticleContainerProps(entry: PixiParticleContainerPoolEntry) {
    const { instance, props } = entry;
    instance.zIndex = props.zIndex ?? 0;
    instance.visible = props.visible ?? true;
    applyBlendMode(instance, props.blendMode);
  }

  private applyParticleProps(entry: PixiParticlePoolEntry) {
    const { instance, props } = entry;
    const container = this.pool.particleContainers.active.get(entry.containerId);
    if (props.atlasFrame && container?.props.atlas) {
      this.applyTexture({ kind: 'atlasFrame', atlas: container.props.atlas, atlasFrame: props.atlasFrame }, (texture) => {
        if (
          container.particles.get(entry.id) === entry &&
          entry.props.atlasFrame === props.atlasFrame
        ) {
          entry.texture = texture;
          instance.texture = texture;
        }
      });
    }

    instance.x = props.x ?? 0;
    instance.y = props.y ?? 0;
    instance.anchor.set(props.anchorX ?? 0, props.anchorY ?? 0);
    instance.scale.set(props.scaleX ?? 1, props.scaleY ?? 1);
    instance.rotation = props.rotation ?? 0;
    instance.alpha = props.alpha ?? 1;
    if (props.tint !== undefined) {
      instance.tint = parseColor(props.tint);
    }
  }

  private redrawGraphic(entry: PixiGraphicPoolEntry) {
    const { instance } = entry;
    instance.clear();

    if (entry.kind === 'lineGraphic') {
      const { props } = entry;
      instance.moveTo(props.start.x, props.start.y);
      instance.lineTo(props.end.x, props.end.y);
    } else if (entry.kind === 'rectangleGraphic') {
      const { props } = entry;
      if (props.radius && props.radius > 0) {
        instance.roundRect(0, 0, props.width, props.height, props.radius);
      } else {
        instance.rect(0, 0, props.width, props.height);
      }
    } else if (entry.kind === 'squareGraphic') {
      const { props } = entry;
      if (props.radius && props.radius > 0) {
        instance.roundRect(0, 0, props.size, props.size, props.radius);
      } else {
        instance.rect(0, 0, props.size, props.size);
      }
    } else if (entry.kind === 'circleGraphic') {
      const { props } = entry;
      instance.circle(0, 0, props.radius);
    } else if (entry.kind === 'ellipseGraphic') {
      const { props } = entry;
      instance.ellipse(0, 0, props.radiusX, props.radiusY);
    } else if (entry.kind === 'polygonGraphic') {
      const { props } = entry;
      instance.poly(props.points.flatMap((point) => [point.x, point.y]));
    } else {
      const { props } = entry;
      drawBezierPath(instance, props);
    }

    applyFillAndStroke(instance, entry.props);
    applyGraphicDisplayProps(instance, entry.props);
  }

  private applyTexture(source: PixiTextureSource, onTexture: (texture: Texture) => void) {
    if (source.kind === 'image') {
      onTexture(Texture.from(source.image));
      return;
    }

    void this.loadTextureAsset(source.atlas).then((asset) => {
      if (isSpritesheet(asset)) {
        const texture = asset.textures[source.atlasFrame];
        if (texture) {
          onTexture(texture);
        }
      }
    });
  }

  private loadTextureAsset(url: string) {
    const cached = this.textureAssetCache.get(url);
    if (cached) {
      return cached;
    }

    const assetPromise = Assets.load<TextureAsset>(url);
    this.textureAssetCache.set(url, assetPromise);
    return assetPromise;
  }
}

function createPoolBucket<TEntry, TReusableInstance>(): PixiPoolBucket<TEntry, TReusableInstance> {
  return {
    active: new Map(),
    idle: [],
  };
}

function createGraphicEntry(
  id: PixiRendererObjectId,
  kind: PixiLineGraphicPoolEntry['kind'],
  instance: Graphics,
  props: PixiLineGraphicProps,
): PixiLineGraphicPoolEntry;
function createGraphicEntry(
  id: PixiRendererObjectId,
  kind: PixiRectangleGraphicPoolEntry['kind'],
  instance: Graphics,
  props: PixiRectangleGraphicProps,
): PixiRectangleGraphicPoolEntry;
function createGraphicEntry(
  id: PixiRendererObjectId,
  kind: PixiSquareGraphicPoolEntry['kind'],
  instance: Graphics,
  props: PixiSquareGraphicProps,
): PixiSquareGraphicPoolEntry;
function createGraphicEntry(
  id: PixiRendererObjectId,
  kind: PixiCircleGraphicPoolEntry['kind'],
  instance: Graphics,
  props: PixiCircleGraphicProps,
): PixiCircleGraphicPoolEntry;
function createGraphicEntry(
  id: PixiRendererObjectId,
  kind: PixiEllipseGraphicPoolEntry['kind'],
  instance: Graphics,
  props: PixiEllipseGraphicProps,
): PixiEllipseGraphicPoolEntry;
function createGraphicEntry(
  id: PixiRendererObjectId,
  kind: PixiPolygonGraphicPoolEntry['kind'],
  instance: Graphics,
  props: PixiPolygonGraphicProps,
): PixiPolygonGraphicPoolEntry;
function createGraphicEntry(
  id: PixiRendererObjectId,
  kind: PixiBezierCurveGraphicPoolEntry['kind'],
  instance: Graphics,
  props: PixiBezierCurveGraphicProps,
): PixiBezierCurveGraphicPoolEntry;
function createGraphicEntry(
  id: PixiRendererObjectId,
  kind: PixiGraphicPoolEntry['kind'],
  instance: Graphics,
  props: PixiGraphicPoolEntry['props'],
): PixiGraphicPoolEntry;
function createGraphicEntry(
  id: PixiRendererObjectId,
  kind: PixiGraphicPoolEntry['kind'],
  instance: Graphics,
  props: PixiGraphicPoolEntry['props'],
): PixiGraphicPoolEntry {
  return {
    id,
    kind,
    instance,
    props,
  } as PixiGraphicPoolEntry;
}

function applyCameraProps(camera: Container, props: { x?: number; y?: number }) {
  camera.x = props.x ?? 0;
  camera.y = props.y ?? 0;
}

function applyGraphicDisplayProps(instance: Graphics, props: PixiGraphicDisplayProps) {
  instance.x = props.x ?? 0;
  instance.y = props.y ?? 0;
  instance.scale.set(props.scaleX ?? 1, props.scaleY ?? 1);
  instance.rotation = props.rotation ?? 0;
  instance.alpha = props.alpha ?? 1;
  instance.visible = props.visible ?? true;
  instance.zIndex = props.zIndex ?? 0;
  applyBlendMode(instance, props.blendMode);
}

function applyFillAndStroke(instance: Graphics, props: PixiGraphicDisplayProps) {
  if (props.fill) {
    instance.fill({
      color: parseColor(props.fill.color ?? 0xffffff),
      alpha: props.fill.alpha ?? 1,
    });
  }
  if (props.stroke) {
    instance.stroke({
      color: parseColor(props.stroke.color ?? 0xffffff),
      alpha: props.stroke.alpha ?? 1,
      width: props.stroke.width ?? 1,
    });
  }
}

function drawBezierPath(instance: Graphics, props: PixiBezierCurveGraphicProps) {
  for (const command of props.path) {
    if (command.type === 'moveTo') {
      instance.moveTo(command.point.x, command.point.y);
    } else if (command.type === 'lineTo') {
      instance.lineTo(command.point.x, command.point.y);
    } else if (command.type === 'quadraticCurveTo') {
      instance.quadraticCurveTo(command.control.x, command.control.y, command.end.x, command.end.y);
    } else if (command.type === 'bezierCurveTo') {
      instance.bezierCurveTo(
        command.control1.x,
        command.control1.y,
        command.control2.x,
        command.control2.y,
        command.end.x,
        command.end.y,
      );
    } else {
      instance.closePath();
    }
  }
}

function applyBlendMode(instance: DisplayObjectWithBlendMode, blendMode: string | undefined) {
  if (blendMode && blendMode !== 'none') {
    instance.blendMode = blendMode;
  } else {
    instance.blendMode = 'normal';
  }
}

function resetDisplayObject(instance: Container | Graphics) {
  instance.x = 0;
  instance.y = 0;
  instance.scale.set(1, 1);
  instance.rotation = 0;
  instance.alpha = 1;
  instance.visible = true;
  instance.zIndex = 0;
  applyBlendMode(instance, undefined);
}

function destroyIdleObjects<TReusableInstance>(
  bucket: PixiPoolBucket<unknown, TReusableInstance>,
  destroyObject: (instance: TReusableInstance) => void,
) {
  for (const instance of bucket.idle) {
    destroyObject(instance);
  }
  bucket.idle = [];
}

function parseColor(value: string | number) {
  return new Color(value).toNumber();
}

function isSpritesheet(asset: TextureAsset): asset is Spritesheet {
  return 'textures' in asset;
}
