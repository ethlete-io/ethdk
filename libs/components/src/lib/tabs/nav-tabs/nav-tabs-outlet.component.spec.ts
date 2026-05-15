import '../../../test-helpers';
import { NavTabsOutletComponent } from './nav-tabs-outlet.component';

describe('NavTabsOutletComponent', () => {
  it('has the et-nav-tabs-outlet selector', () => {
    const selectors = (NavTabsOutletComponent as any).ɵcmp?.selectors;
    expect(JSON.stringify(selectors)).toContain('et-nav-tabs-outlet');
  });

  it('uses ViewEncapsulation.None', () => {
    // encapsulation 2 = ViewEncapsulation.None
    const encapsulation = (NavTabsOutletComponent as any).ɵcmp?.encapsulation;
    expect(encapsulation).toBe(2);
  });
});
