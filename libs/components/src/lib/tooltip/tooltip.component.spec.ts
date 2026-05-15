import '../../test-helpers';
import { TooltipComponent } from './tooltip.component';

describe('TooltipComponent', () => {
  it('has the et-tooltip selector', () => {
    const selector = (TooltipComponent as any).ɵcmp?.selectors;
    expect(JSON.stringify(selector)).toContain('et-tooltip');
  });

  it('uses ViewEncapsulation.None', () => {
    // encapsulation 2 = ViewEncapsulation.None
    const encapsulation = (TooltipComponent as any).ɵcmp?.encapsulation;
    expect(encapsulation).toBe(2);
  });
});
