import '../../../test-helpers';
import { NavTabLinkComponent } from './nav-tab-link.component';

describe('NavTabLinkComponent', () => {
  it('uses the et-nav-tab-link selector', () => {
    const selector = (NavTabLinkComponent as any).ɵcmp?.selectors;
    expect(JSON.stringify(selector)).toContain('et-nav-tab-link');
  });

  it('uses ViewEncapsulation.None', () => {
    // encapsulation 2 = ViewEncapsulation.None
    const encapsulation = (NavTabLinkComponent as any).ɵcmp?.encapsulation;
    expect(encapsulation).toBe(2);
  });
});
