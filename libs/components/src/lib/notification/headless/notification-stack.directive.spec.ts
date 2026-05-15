import '../../../test-helpers';
import { NotificationStackDirective } from './notification-stack.directive';

describe('NotificationStackDirective', () => {
  it('has the correct selector', () => {
    const selectors = (NotificationStackDirective as any).ɵdir?.selectors;
    expect(selectors).toBeDefined();
    expect(JSON.stringify(selectors)).toContain('etNotificationStack');
  });

  it('is exported as etNotificationStack', () => {
    const exportAs = (NotificationStackDirective as any).ɵdir?.exportAs;
    expect(exportAs).toContain('etNotificationStack');
  });
});
