import type { GameObject, Entity, GraphicComponent, TransformComponent } from '../types';
import { createBehaviorComponentAccessor, type BehaviorComponentAccessor } from './utils/componentAccess';
import { sendDebugCommand } from '../../debug/DebugLogger';

/**
 * 灯光行为：响应信号改变亮度
 */
export class LightBehavior implements GameObject {
  public readonly entity: Entity;
  public emit?: (signal: string, payload?: any) => void;
  private brightness: number = 0;
  private readonly componentAccess: BehaviorComponentAccessor;
  private baseX?: number;

  constructor(entity: Entity, params: Record<string, any>) {
    this.entity = entity;
    this.componentAccess = createBehaviorComponentAccessor(entity, 'LightBehavior', params);
    this.brightness = params.initialBrightness || 0;
  }

  onAwake() {
    sendDebugCommand({
      level: 'DEBUG',
      source: 'LightBehavior',
      message: 'onAwake',
      detail: {
        entityId: this.entity.id,
        brightness: this.brightness,
      },
    });
    const transform = this.componentAccess.getComponent<TransformComponent>('Transform');
    if (transform) {
      this.baseX = transform.position.x;
    }
    this.applyBrightness();
  }

  /**
   * 响应开关信号的 Action
   */
  onSwitchToggled(payload: any) {
    sendDebugCommand({
      level: 'DEBUG',
      source: 'LightBehavior',
      message: 'onSwitchToggled received',
      detail: {
        entityId: this.entity.id,
        payload,
      },
    });
    const newState = payload?.state;
    this.brightness = newState === 'on' ? 1.0 : 0.15;
    this.applyBrightness();
    
    // 也可以再发一个本地信号，触发本地的其他效果（比如粒子）
    this.emit?.('LOCAL:brightness_changed', { brightness: this.brightness });
  }

  setIntensity(payload: any) {
    this.setBrightness(payload);
  }

  setBrightness(payload: any) {
    const value = payload?.intensity !== undefined ? payload.intensity : (payload?.value ?? 0);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      this.componentAccess.reportIssue('invalid message payload for brightness', {
        message: 'setBrightness',
        payload,
      });
      return;
    }
    this.brightness = parsed;
    this.applyBrightness();
  }

  private applyBrightness() {
    if (!Number.isFinite(this.brightness)) {
      this.componentAccess.reportIssue('invalid brightness value', {
        brightness: this.brightness,
      });
      return;
    }

    if (!this.componentAccess.setProperty('Graphic', 'alpha', this.brightness)) {
      return;
    }

    const graphic = this.componentAccess.getComponent<GraphicComponent>('Graphic');
    const isOn = this.brightness >= 0.5;

    if (graphic?.fill) {
      this.componentAccess.setProperty('Graphic', 'fill.alpha', this.brightness);
      this.componentAccess.setProperty('Graphic', 'fill.color', isOn ? '#fbbf24' : '#334155');
    }

    // 增加明显位移效果，确保切换状态一眼可见
    if (this.baseX !== undefined) {
      this.componentAccess.setProperty('Transform', 'position.x', isOn ? this.baseX + 60 : this.baseX);
    }
  }

  onMessage(message: string, payload: any): boolean {
    sendDebugCommand({
      level: 'DEBUG',
      source: 'LightBehavior',
      message: 'onMessage received',
      detail: {
        entityId: this.entity.id,
        message,
        payload,
      },
    });
    if (message === 'onSwitchToggled') {
      this.onSwitchToggled(payload);
      return true;
    } else if (message === 'setBrightness' || message === 'setIntensity') {
      this.setBrightness(payload);
      return true;
    }
    return false;
  }
}
