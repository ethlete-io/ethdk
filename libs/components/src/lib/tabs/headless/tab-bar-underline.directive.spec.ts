import '../../../test-helpers';
import { TabBarUnderlineDirective } from './tab-bar-underline.directive';

describe('TabBarUnderlineDirective', () => {
  it('has the correct selector', () => {
    const selectors = (TabBarUnderlineDirective as any).ɵdir?.selectors;
    expect(JSON.stringify(selectors)).toContain('etTabBarUnderline');
  });

  it('is a class constructor', () => {
    expect(typeof TabBarUnderlineDirective).toBe('function');
  });
});
