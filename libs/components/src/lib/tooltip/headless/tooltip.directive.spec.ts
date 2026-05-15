import '../../../test-helpers';
import { TooltipDirective } from './tooltip.directive';

describe('TooltipDirective', () => {
  it('has the correct selector', () => {
    const selectors = (TooltipDirective as any).ɵdir?.selectors;
    expect(JSON.stringify(selectors)).toContain('etTooltip');
  });

  it('is exported as etTooltip', () => {
    const exportAs = (TooltipDirective as any).ɵdir?.exportAs;
    expect(exportAs).toContain('etTooltip');
  });

  it('declares content input aliased as etTooltip', () => {
    const inputs = (TooltipDirective as any).ɵdir?.inputs;
    // content is aliased as 'etTooltip'
    expect(JSON.stringify(inputs)).toContain('content');
  });

  it('declares placement input', () => {
    const inputs = (TooltipDirective as any).ɵdir?.inputs;
    expect(Object.keys(inputs)).toContain('placement');
  });

  it('declares disabled input (aliased as etTooltipDisabled)', () => {
    const inputs = (TooltipDirective as any).ɵdir?.inputs;
    expect(JSON.stringify(inputs)).toContain('disabled');
  });

  it('declares showDelay input', () => {
    const inputs = (TooltipDirective as any).ɵdir?.inputs;
    expect(Object.keys(inputs)).toContain('showDelay');
  });
});
