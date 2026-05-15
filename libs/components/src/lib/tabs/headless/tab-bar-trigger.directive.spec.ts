import '../../../test-helpers';
import { TabBarTriggerDirective } from './tab-bar-trigger.directive';

describe('TabBarTriggerDirective', () => {
  it('has the correct selector', () => {
    const selectors = (TabBarTriggerDirective as any).ɵdir?.selectors;
    expect(JSON.stringify(selectors)).toContain('etTabBarTrigger');
  });

  it('declares a disabled input', () => {
    const inputs = (TabBarTriggerDirective as any).ɵdir?.inputs;
    expect(Object.keys(inputs)).toContain('disabled');
  });
});
