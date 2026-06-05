import { InputConfig } from '@sence/type/base/InputConfig';
import type { InputSignalRoute } from '@sence/type/base/InputSignalRoute';

// 2. 引擎配置 [cite: 7]
export class EngineConfig {
    systemPipeline: Array<{ name: string, enabled: boolean }> = []; // [cite: 7]
    inputConfig: InputConfig = new InputConfig(); // [cite: 7, 8, 9, 10, 11]
    inputToSignalMap: InputSignalRoute[] = []; // [cite: 11, 12]
}
