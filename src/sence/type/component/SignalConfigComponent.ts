import type { IComponent } from '@sence/type/base/IComponent';

// 4.11 信号配置组件 (SignalConfig) [cite: 29, 30]
export interface SignalListener {
    event: string;
    target: string;
    action: string;
    args?: Record<string, any>;
}

export class SignalConfigComponent implements IComponent {
    readonly type = 'SignalConfig';
    listeners: SignalListener[] = [];
}
