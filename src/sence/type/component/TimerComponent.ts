import type { IComponent } from '@sence/type/base/IComponent';

// 4.14 定时器组件 (Timer) [cite: 34, 35]
export class TimerComponent implements IComponent {
    readonly type = 'Timer';
    duration!: number; // 必填
    time: number = 0;
    loop: boolean = false;
    active: boolean = true;
    onCompleteSignal?: string;
}
