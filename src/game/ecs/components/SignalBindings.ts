import type { SignalBindingRule, SignalBindingsComponent } from '../../types';
export type { SignalBindingRule, SignalBindingsComponent };

export const createSignalBindings = (
  rules: SignalBindingRule[] = [],
): SignalBindingsComponent => ({
  type: 'SignalBindings',
  rules,
});
