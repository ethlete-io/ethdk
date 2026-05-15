import '../../../test-helpers';
import { NotificationDirective } from './notification.directive';

describe('NotificationDirective', () => {
  it('has the correct selector', () => {
    const selectors = (NotificationDirective as any).ɵdir?.selectors;
    expect(selectors).toBeDefined();
    expect(JSON.stringify(selectors)).toContain('etNotification');
  });

  it('is exported as etNotification', () => {
    const exportAs = (NotificationDirective as any).ɵdir?.exportAs;
    expect(exportAs).toContain('etNotification');
  });

  it('declares a required ref input', () => {
    const inputs = (NotificationDirective as any).ɵdir?.inputs;
    expect(inputs).toBeDefined();
    expect(Object.keys(inputs)).toContain('ref');
  });
});
