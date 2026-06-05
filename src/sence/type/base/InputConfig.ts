export interface InputAction {
    id: string;
    type: 'button' | 'axis1' | 'axis2';
}

export interface InputActionMap {
    id: string;
    enabled: boolean;
    actions: InputAction[];
}

export interface InputBinding {
    action: string;
    map: string;
    path?: string;
    kind?: string;
    parts?: Array<{ name: string, path: string }>;
    processor?: string;
}

export class InputConfig {
    mode: 'strict' | 'loose' = 'strict';
    devicePolicy: string[] = [];
    deadzone: number = 0.15;
    actionMaps: InputActionMap[] = [];
    bindings: InputBinding[] = [];
}
