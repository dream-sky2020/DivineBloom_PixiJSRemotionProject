export interface InputSignalRoute {
    action: string;
    phase: 'pressed' | 'released' | 'held' | 'changed';
    emit: string;
    throttleMs?: number;
    sets?: Array<{ key: string, from?: string, value?: any }>;
}
