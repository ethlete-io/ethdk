import '../../../test-helpers';
import { PipSlotPlaceholderComponent } from './pip-slot-placeholder.component';

describe('PipSlotPlaceholderComponent', () => {
  it('has the et-pip-slot-placeholder selector', () => {
    const selector = (PipSlotPlaceholderComponent as any).ɵcmp?.selectors;
    expect(JSON.stringify(selector)).toContain('et-pip-slot-placeholder');
  });

  it('uses ViewEncapsulation.None', () => {
    // encapsulation 2 = ViewEncapsulation.None
    const encapsulation = (PipSlotPlaceholderComponent as any).ɵcmp?.encapsulation;
    expect(encapsulation).toBe(2);
  });
});
