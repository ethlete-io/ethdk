import '../../../test-helpers';
import { TabLabelDirective } from './tab-label.directive';

describe('TabLabelDirective', () => {
  it('has the correct selector', () => {
    const selectors = (TabLabelDirective as any).ɵdir?.selectors;
    expect(JSON.stringify(selectors)).toContain('etTabLabel');
  });

  it('is a class constructor', () => {
    expect(typeof TabLabelDirective).toBe('function');
  });
});
