import '../../test-helpers';
import { ToggletipComponent } from './toggletip.component';

describe('ToggletipComponent', () => {
  it('has the et-toggletip selector', () => {
    const selector = (ToggletipComponent as any).ɵcmp?.selectors;
    expect(JSON.stringify(selector)).toContain('et-toggletip');
  });

  it('uses ViewEncapsulation.None', () => {
    // encapsulation 2 = ViewEncapsulation.None
    const encapsulation = (ToggletipComponent as any).ɵcmp?.encapsulation;
    expect(encapsulation).toBe(2);
  });
});
