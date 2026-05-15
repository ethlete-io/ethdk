import '../../../test-helpers';
import { ToggletipDirective } from './toggletip.directive';

describe('ToggletipDirective', () => {
  it('has the correct selector', () => {
    const selectors = (ToggletipDirective as any).ɵdir?.selectors;
    expect(JSON.stringify(selectors)).toContain('etToggletip');
  });

  it('is exported as etToggletip', () => {
    const exportAs = (ToggletipDirective as any).ɵdir?.exportAs;
    expect(exportAs).toContain('etToggletip');
  });

  it('declares content input', () => {
    const inputs = (ToggletipDirective as any).ɵdir?.inputs;
    expect(JSON.stringify(inputs)).toContain('content');
  });

  it('declares an open model input (aliased as etToggletipOpen)', () => {
    const inputs = (ToggletipDirective as any).ɵdir?.inputs;
    // open model is aliased as etToggletipOpen
    expect(JSON.stringify(inputs)).toContain('open');
  });

  it('declares placement input', () => {
    const inputs = (ToggletipDirective as any).ɵdir?.inputs;
    expect(Object.keys(inputs)).toContain('placement');
  });

  it('declares disabled input (aliased as etToggletipDisabled)', () => {
    const inputs = (ToggletipDirective as any).ɵdir?.inputs;
    expect(JSON.stringify(inputs)).toContain('disabled');
  });
});
