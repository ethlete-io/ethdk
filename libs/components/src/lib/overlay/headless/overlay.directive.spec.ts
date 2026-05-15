import '../../../test-helpers';
import { OverlayDirective } from './overlay.directive';

describe('OverlayDirective', () => {
  it('has the correct selector', () => {
    const selectors = (OverlayDirective as any).ɵdir?.selectors;
    expect(selectors).toBeDefined();
    expect(JSON.stringify(selectors)).toContain('etOverlay');
  });

  it('is exported as etOverlay', () => {
    const exportAs = (OverlayDirective as any).ɵdir?.exportAs;
    expect(exportAs).toContain('etOverlay');
  });

  it('declares open and mode inputs', () => {
    const inputs = (OverlayDirective as any).ɵdir?.inputs;
    expect(inputs).toBeDefined();
    const keys = Object.keys(inputs);
    expect(keys).toContain('open');
    expect(keys).toContain('mode');
  });

  it('declares open model output (openChange)', () => {
    const outputs = (OverlayDirective as any).ɵdir?.outputs;
    expect(outputs).toBeDefined();
    // open is a model() — its change output is 'openChange'
    expect(Object.keys(outputs)).toContain('openChange');
  });
});
