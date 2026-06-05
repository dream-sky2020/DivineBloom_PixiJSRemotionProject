import type { SignalBindingRule, SignalConfigComponent } from '../../types';
export type { SignalBindingRule, SignalConfigComponent };

export const createSignalConfig = (
  rules: SignalBindingRule[] = [],
): SignalConfigComponent => ({
  type: 'SignalConfig',
  rules,
});
