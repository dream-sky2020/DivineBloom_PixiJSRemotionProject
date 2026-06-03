import * as planck from 'planck';

export type PhysicsShapeType = 'circle' | 'rectangle' | 'triangle' | 'polygon';

export interface PhysicsObjectState {
  id: string;
  type: PhysicsShapeType;
  x: number;
  y: number;
  rotation: number;
  // 对于不同形状的额外属性
  radius?: number;
  width?: number;
  height?: number;
  points?: { x: number, y: number }[];
  color?: string;
}

export interface PhysicsPoint {
  x: number;
  y: number;
}

export interface PhysicsObjectDetailedState extends PhysicsObjectState {
  worldCenter: PhysicsPoint;
  linearVelocity: PhysicsPoint;
  angularVelocity: number;
  localPoints?: PhysicsPoint[];
  worldPoints?: PhysicsPoint[];
}

export type PhysicsContactPhase = 'enter' | 'stay' | 'exit';

export interface PhysicsContactEvent {
  selfId: string;
  otherId: string;
  phase: PhysicsContactPhase;
}

export class PhysicsSystem {
  private world: planck.World;
  private bodies: Map<string, planck.Body> = new Map();
  private metadata: Map<string, any> = new Map();
  private activeContactPairs: Set<string> = new Set();
  private enteredContactPairs: Set<string> = new Set();
  private exitedContactPairs: Set<string> = new Set();

  constructor(gravity = { x: 0.0, y: 0.0 }) {
    // 创建物理世界
    this.world = new planck.World({
      gravity: planck.Vec2(gravity.x, gravity.y)
    });
    this.attachContactListeners();
  }

  static async init() {
    // Planck 是纯 JS，不需要异步初始化，但为了保持 API 兼容性保留此方法
    return Promise.resolve();
  }

  /**
   * 执行物理步进
   * @param substeps 子步数，增加子步可以极大提高高速运动下的碰撞精度
   * Planck 的 step 默认建议使用 1/60s
   */
  step(substeps = 1) {
    this.enteredContactPairs.clear();
    this.exitedContactPairs.clear();

    const dt = 1 / 60;
    const velocityIterations = 8;
    const positionIterations = 3;
    
    if (substeps <= 1) {
      this.world.step(dt, velocityIterations, positionIterations);
    } else {
      const subDt = dt / substeps;
      for (let i = 0; i < substeps; i++) {
        this.world.step(subDt, velocityIterations, positionIterations);
      }
    }
  }

  private createBody(id: string, x: number, y: number, isStatic: boolean, options: any = {}) {
    const body = this.world.createBody({
      type: isStatic ? 'static' : 'dynamic',
      position: planck.Vec2(x, y),
      bullet: options.bullet ?? !isStatic, // 开启类似 CCD 的高速碰撞检测
      fixedRotation: options.fixedRotation ?? false,
      gravityScale: options.gravityScale ?? 1.0,
    });
    body.setUserData({ id });
    this.bodies.set(id, body);
    return body;
  }

  createCircle(id: string, x: number, y: number, radius: number, isStatic = false, options: any = {}) {
    const body = this.createBody(id, x, y, isStatic, options);
    
    body.createFixture({
      shape: planck.Circle(radius),
      restitution: options.restitution ?? 0.7,
      friction: options.friction ?? 0.5,
      density: options.density ?? 1.0,
      isSensor: options.sensor ?? false,
    });
    
    this.metadata.set(id, { type: 'circle', radius, color: options.color });
    return body;
  }

  createRectangle(id: string, x: number, y: number, width: number, height: number, isStatic = false, options: any = {}) {
    const body = this.createBody(id, x, y, isStatic, options);
    
    // Planck 的 Box 接收半宽和半高
    body.createFixture({
      shape: planck.Box(width / 2, height / 2),
      restitution: options.restitution ?? 0.7,
      friction: options.friction ?? 0.5,
      density: options.density ?? 1.0,
      isSensor: options.sensor ?? false,
    });
    
    this.metadata.set(id, { type: 'rectangle', width, height, color: options.color });
    return body;
  }

  createTriangle(id: string, x: number, y: number, p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}, isStatic = false, options: any = {}) {
    const body = this.createBody(id, x, y, isStatic, options);
    
    // Planck 的 Polygon 接收 Vec2 数组
    const vertices = [
      planck.Vec2(p1.x, p1.y),
      planck.Vec2(p2.x, p2.y),
      planck.Vec2(p3.x, p3.y)
    ];
    
    body.createFixture({
      shape: planck.Polygon(vertices),
      restitution: options.restitution ?? 0.7,
      friction: options.friction ?? 0.5,
      density: options.density ?? 1.0,
      isSensor: options.sensor ?? false,
    });
    
    this.metadata.set(id, { type: 'triangle', points: [p1, p2, p3], color: options.color });
    return body;
  }

  createPolygon(id: string, x: number, y: number, points: {x: number, y: number}[], isStatic = false, options: any = {}) {
    const body = this.createBody(id, x, y, isStatic, options);
    
    const vertices = points.map(p => planck.Vec2(p.x, p.y));
    
    body.createFixture({
      shape: planck.Polygon(vertices),
      restitution: options.restitution ?? 0.7,
      friction: options.friction ?? 0.5,
      density: options.density ?? 1.0,
      isSensor: options.sensor ?? false,
    });
    
    this.metadata.set(id, { type: 'polygon', points, color: options.color });
    return body;
  }

  setLinearVelocity(id: string, x: number, y: number) {
    const body = this.bodies.get(id);
    if (body) {
      body.setLinearVelocity(planck.Vec2(x, y));
    }
  }

  removeObject(id: string) {
    const body = this.bodies.get(id);
    if (body) {
      this.detachBodyContacts(id);
      this.world.destroyBody(body);
      this.bodies.delete(id);
      this.metadata.delete(id);
    }
  }

  consumeContactEvents(): PhysicsContactEvent[] {
    const events: PhysicsContactEvent[] = [];

    for (const pairKey of this.enteredContactPairs) {
      const pair = decodePairKey(pairKey);
      if (!pair) continue;
      events.push({ selfId: pair.a, otherId: pair.b, phase: 'enter' });
      events.push({ selfId: pair.b, otherId: pair.a, phase: 'enter' });
    }

    for (const pairKey of this.activeContactPairs) {
      if (this.enteredContactPairs.has(pairKey)) continue;
      const pair = decodePairKey(pairKey);
      if (!pair) continue;
      events.push({ selfId: pair.a, otherId: pair.b, phase: 'stay' });
      events.push({ selfId: pair.b, otherId: pair.a, phase: 'stay' });
    }

    for (const pairKey of this.exitedContactPairs) {
      const pair = decodePairKey(pairKey);
      if (!pair) continue;
      events.push({ selfId: pair.a, otherId: pair.b, phase: 'exit' });
      events.push({ selfId: pair.b, otherId: pair.a, phase: 'exit' });
    }

    this.enteredContactPairs.clear();
    this.exitedContactPairs.clear();
    return events;
  }

  getAllStates(): PhysicsObjectState[] {
    const states: PhysicsObjectState[] = [];
    this.bodies.forEach((body, id) => {
      const position = body.getPosition();
      const rotation = body.getAngle();
      const meta = this.metadata.get(id);
      
      states.push({
        id,
        x: position.x,
        y: position.y,
        rotation: rotation,
        ...meta
      });
    });
    return states;
  }

  /**
   * 获取包含每个物理对象详细几何信息的状态（含世界坐标点位）
   * - 多边形/矩形/三角形：返回 localPoints + worldPoints
   * - 圆形：返回圆心与离散采样点（默认 32 段）
   */
  getAllDetailedStates(options: { circleSegments?: number } = {}): PhysicsObjectDetailedState[] {
    const circleSegments = Math.max(8, options.circleSegments ?? 32);
    const states: PhysicsObjectDetailedState[] = [];

    this.bodies.forEach((body, id) => {
      const position = body.getPosition();
      const rotation = body.getAngle();
      const velocity = body.getLinearVelocity();
      const angularVelocity = body.getAngularVelocity();
      const meta = this.metadata.get(id);

      const detailedState: PhysicsObjectDetailedState = {
        id,
        x: position.x,
        y: position.y,
        rotation,
        worldCenter: { x: position.x, y: position.y },
        linearVelocity: { x: velocity.x, y: velocity.y },
        angularVelocity,
        ...meta,
      };

      const geometry = this.extractBodyGeometryPoints(body, circleSegments);
      if (geometry.localPoints) {
        detailedState.localPoints = geometry.localPoints;
      }
      if (geometry.worldPoints) {
        detailedState.worldPoints = geometry.worldPoints;
      }

      states.push(detailedState);
    });

    return states;
  }

  getDetailedState(id: string, options: { circleSegments?: number } = {}): PhysicsObjectDetailedState | null {
    const body = this.bodies.get(id);
    if (!body) return null;

    const circleSegments = Math.max(8, options.circleSegments ?? 32);
    const position = body.getPosition();
    const rotation = body.getAngle();
    const velocity = body.getLinearVelocity();
    const angularVelocity = body.getAngularVelocity();
    const meta = this.metadata.get(id);

    const detailedState: PhysicsObjectDetailedState = {
      id,
      x: position.x,
      y: position.y,
      rotation,
      worldCenter: { x: position.x, y: position.y },
      linearVelocity: { x: velocity.x, y: velocity.y },
      angularVelocity,
      ...meta,
    };

    const geometry = this.extractBodyGeometryPoints(body, circleSegments);
    if (geometry.localPoints) {
      detailedState.localPoints = geometry.localPoints;
    }
    if (geometry.worldPoints) {
      detailedState.worldPoints = geometry.worldPoints;
    }

    return detailedState;
  }

  private extractBodyGeometryPoints(body: planck.Body, circleSegments: number): {
    localPoints?: PhysicsPoint[];
    worldPoints?: PhysicsPoint[];
  } {
    const localPoints: PhysicsPoint[] = [];
    const worldPoints: PhysicsPoint[] = [];

    for (let fixture = body.getFixtureList(); fixture; fixture = fixture.getNext()) {
      const shape = fixture.getShape() as any;
      const shapeType = typeof shape.getType === 'function' ? shape.getType() : '';

      if (shapeType === 'polygon' && Array.isArray(shape.m_vertices)) {
        shape.m_vertices.forEach((vertex: any) => {
          const local = planck.Vec2(vertex.x, vertex.y);
          const world = body.getWorldPoint(local);
          localPoints.push({ x: local.x, y: local.y });
          worldPoints.push({ x: world.x, y: world.y });
        });
        continue;
      }

      if (shapeType === 'circle') {
        const centerLocal = shape.m_p ? planck.Vec2(shape.m_p.x, shape.m_p.y) : planck.Vec2(0, 0);
        const radius = typeof shape.m_radius === 'number' ? shape.m_radius : 0;

        for (let i = 0; i < circleSegments; i++) {
          const angle = (i / circleSegments) * Math.PI * 2;
          const lx = centerLocal.x + Math.cos(angle) * radius;
          const ly = centerLocal.y + Math.sin(angle) * radius;
          const local = planck.Vec2(lx, ly);
          const world = body.getWorldPoint(local);
          localPoints.push({ x: local.x, y: local.y });
          worldPoints.push({ x: world.x, y: world.y });
        }
      }
    }

    return {
      localPoints: localPoints.length > 0 ? localPoints : undefined,
      worldPoints: worldPoints.length > 0 ? worldPoints : undefined,
    };
  }

  private attachContactListeners(): void {
    this.world.on('begin-contact', (contact) => {
      const pairKey = this.createContactPairKey(contact);
      if (!pairKey) return;
      if (!this.activeContactPairs.has(pairKey)) {
        this.enteredContactPairs.add(pairKey);
      }
      this.activeContactPairs.add(pairKey);
    });

    this.world.on('end-contact', (contact) => {
      const pairKey = this.createContactPairKey(contact);
      if (!pairKey) return;
      if (this.activeContactPairs.has(pairKey)) {
        this.activeContactPairs.delete(pairKey);
        this.exitedContactPairs.add(pairKey);
      }
    });
  }

  private createContactPairKey(contact: planck.Contact): string | null {
    const fixtureA = contact.getFixtureA();
    const fixtureB = contact.getFixtureB();
    const bodyA = fixtureA?.getBody();
    const bodyB = fixtureB?.getBody();
    const idA = readBodyId(bodyA);
    const idB = readBodyId(bodyB);
    if (!idA || !idB || idA === idB) {
      return null;
    }
    return encodePairKey(idA, idB);
  }

  private detachBodyContacts(bodyId: string): void {
    for (const pairKey of [...this.activeContactPairs]) {
      const pair = decodePairKey(pairKey);
      if (!pair) continue;
      if (pair.a === bodyId || pair.b === bodyId) {
        this.activeContactPairs.delete(pairKey);
        this.enteredContactPairs.delete(pairKey);
        this.exitedContactPairs.add(pairKey);
      }
    }
  }

  destroy() {
    // Planck 不需要显式 free，但可以清除引用
    this.bodies.clear();
    this.metadata.clear();
    // 销毁世界中的所有物体
    for (let b = this.world.getBodyList(); b; b = b.getNext()) {
      this.world.destroyBody(b);
    }
  }
}

function readBodyId(body: planck.Body | null | undefined): string | null {
  if (!body) return null;
  const userData = body.getUserData() as { id?: string } | undefined;
  return userData?.id || null;
}

function encodePairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function decodePairKey(pairKey: string): { a: string; b: string } | null {
  const [a, b] = pairKey.split('\u0000');
  if (!a || !b) return null;
  return { a, b };
}
