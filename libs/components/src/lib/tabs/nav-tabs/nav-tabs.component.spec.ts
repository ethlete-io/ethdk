import '../../../test-helpers';
import { NavTabsComponent } from './nav-tabs.component';

describe('NavTabsComponent', () => {
  it('uses the et-nav-tabs selector', () => {
    const selector = (NavTabsComponent as any).ɵcmp?.selectors;
    expect(JSON.stringify(selector)).toContain('et-nav-tabs');
  });

  it('uses ViewEncapsulation.None', () => {
    // encapsulation 2 = ViewEncapsulation.None
    const encapsulation = (NavTabsComponent as any).ɵcmp?.encapsulation;
    expect(encapsulation).toBe(2);
  });
});
