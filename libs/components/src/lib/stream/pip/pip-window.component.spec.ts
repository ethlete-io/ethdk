import '../../../test-helpers';
import { PipWindowComponent } from './pip-window.component';

describe('PipWindowComponent', () => {
  it('has the et-pip-window selector', () => {
    const selector = (PipWindowComponent as any).ɵcmp?.selectors;
    expect(JSON.stringify(selector)).toContain('et-pip-window');
  });

  it('uses ViewEncapsulation.None', () => {
    // encapsulation 2 = ViewEncapsulation.None
    const encapsulation = (PipWindowComponent as any).ɵcmp?.encapsulation;
    expect(encapsulation).toBe(2);
  });
});
