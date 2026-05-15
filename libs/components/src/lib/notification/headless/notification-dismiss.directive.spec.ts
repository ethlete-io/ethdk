import '../../../test-helpers';
import { NotificationDismissDirective } from './notification-dismiss.directive';

describe('NotificationDismissDirective', () => {
  it('has the correct selector', () => {
    const selectors = (NotificationDismissDirective as any).ɵdir?.selectors;
    expect(selectors).toBeDefined();
    expect(JSON.stringify(selectors)).toContain('etNotificationDismiss');
  });

  it('is exported as etNotificationDismiss', () => {
    const exportAs = (NotificationDismissDirective as any).ɵdir?.exportAs;
    expect(exportAs).toContain('etNotificationDismiss');
  });
});
