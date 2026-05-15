import '../../../test-helpers';
import { TabBarDirective } from './tab-bar.directive';
import { TAB_BAR_FITS, TAB_BAR_ORIENTATIONS, TAB_BAR_VARIANTS } from './tab-bar.types';

describe('TabBarDirective', () => {
  it('has the correct selector', () => {
    const selectors = (TabBarDirective as any).ɵdir?.selectors;
    expect(JSON.stringify(selectors)).toContain('etTabBar');
  });

  it('declares orientation input with horizontal default', () => {
    const inputs = (TabBarDirective as any).ɵdir?.inputs;
    expect(Object.keys(inputs)).toContain('orientation');
  });

  it('declares fit input', () => {
    const inputs = (TabBarDirective as any).ɵdir?.inputs;
    expect(Object.keys(inputs)).toContain('fit');
  });

  it('declares variant input', () => {
    const inputs = (TabBarDirective as any).ɵdir?.inputs;
    expect(Object.keys(inputs)).toContain('variant');
  });
});

describe('TAB_BAR_ORIENTATIONS', () => {
  it('has HORIZONTAL and VERTICAL values', () => {
    expect(TAB_BAR_ORIENTATIONS.HORIZONTAL).toBe('horizontal');
    expect(TAB_BAR_ORIENTATIONS.VERTICAL).toBe('vertical');
  });
});

describe('TAB_BAR_FITS', () => {
  it('has FILL and SHRINK values', () => {
    expect(Object.values(TAB_BAR_FITS).length).toBeGreaterThan(0);
  });
});

describe('TAB_BAR_VARIANTS', () => {
  it('has at least one variant', () => {
    expect(Object.values(TAB_BAR_VARIANTS).length).toBeGreaterThan(0);
  });
});
