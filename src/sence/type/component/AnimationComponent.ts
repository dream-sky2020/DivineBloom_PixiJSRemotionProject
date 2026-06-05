import type { IComponent } from '@sence/type/base/IComponent';

// 4.13 动画组件 (Animation) [cite: 30, 31, 32, 33, 34]
export interface AnimationKey {
    frame: number;
    value: number | string | boolean;
    easing?: string;
}

export interface AnimationTrack {
    prop: string;
    interpolation: 'hold' | 'linear';
    valueMode: 'absolute' | 'relative';
    keys: AnimationKey[];
}

export interface AnimationLabel {
    name: string;
    duration: number;
    loop: boolean;
    speed: number;
    tracks: AnimationTrack[];
}

export class AnimationComponent implements IComponent {
    readonly type = 'Animation';
    defaultLabel?: string;
    activeLabel?: string;     // 运行时状态
    currentFrame: number = 0; // 运行时状态
    labels: Map<string, AnimationLabel> = new Map();
}
