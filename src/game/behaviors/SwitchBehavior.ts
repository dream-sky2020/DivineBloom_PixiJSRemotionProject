import type { GameObject, Entity, GraphicComponent } from '../types';
import { createBehaviorComponentAccessor, type BehaviorComponentAccessor } from './utils/componentAccess';
import { sendDebugCommand } from '../../debug/DebugLogger';

/**
 * 开关行为：点击或触发时发送全局信号
 */
export class SwitchBehavior implements GameObject {
  public readonly entity: Entity;
  public emit?: (signal: string, payload?: any) => void;
  private isOn: boolean = false;
  private readonly componentAccess: BehaviorComponentAccessor;

  constructor(entity: Entity, params: Record<string, any>) {
    this.entity = entity;
    this.isOn = params.initialState === 'on';
    this.componentAccess = createBehaviorComponentAccessor(entity, 'SwitchBehavior', params);
  }

  onAwake() {
    this.updateVisual();
  }

  /**
   * 供 SignalConfig 调用的 Action
   */
  toggle() {
    this.isOn = !this.isOn;
    sendDebugCommand({
      level: 'DEBUG',
      source: 'SwitchBehavior',
      message: `toggle() -> ${this.isOn ? 'ON' : 'OFF'}`,
      detail: {
        entityId: this.entity.id,
        entityName: this.entity.name,
      },
    });
    this.updateVisual();
    
    // 发送本地信号，供 Interface 或 SignalConfig 使用
    this.emit?.('LOCAL:toggled', { 
      state: this.isOn ? 'on' : 'off' 
    });
    sendDebugCommand({
      level: 'DEBUG',
      source: 'SwitchBehavior',
      message: 'emitted LOCAL:toggled',
      detail: {
        entityId: this.entity.id,
        state: this.isOn ? 'on' : 'off',
      },
    });
    
    // 发送全局信号（保持向后兼容）
    this.emit?.('GLOBAL:SWITCH_TOGGLED', { 
      id: this.entity.id, 
      name: this.entity.name,
      state: this.isOn ? 'on' : 'off' 
    });
    sendDebugCommand({
      level: 'DEBUG',
      source: 'SwitchBehavior',
      message: 'emitted GLOBAL:SWITCH_TOGGLED',
      detail: {
        entityId: this.entity.id,
        entityName: this.entity.name,
        state: this.isOn ? 'on' : 'off',
      },
    });
  }

  private updateVisual() {
    // 尝试更新 Graphic 或 Sprite 的颜色/透明度来反馈状态
    const graphic = this.componentAccess.getComponent<GraphicComponent>('Graphic', { required: true });
    if (graphic?.fill) {
      this.componentAccess.setProperty('Graphic', 'fill.color', this.isOn ? '#fde047' : '#4b5563');
    }
  }

  onMessage(message: string, _payload: any): boolean {
    sendDebugCommand({
      level: 'DEBUG',
      source: 'SwitchBehavior',
      message: 'onMessage received',
      detail: {
        entityId: this.entity.id,
        message,
      },
    });
    if (message === 'toggle') {
      this.toggle();
      return true;
    }
    return false;
  }
}
