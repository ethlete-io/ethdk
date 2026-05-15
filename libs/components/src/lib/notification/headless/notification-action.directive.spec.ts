import '../../../test-helpers';
import { NotificationActionDirective } from './notification-action.directive';

describe('NotificationActionDirective', () => {
  it('has the correct selector', () => {
    const selectors = (NotificationActionDirective as any).ɵdir?.selectors;
    expect(JSON.stringify(selectors)).toContain('etNotificationAction');
  });

  it('is exported as etNotificationAction', () => {
    const exportAs = (NotificationActionDirective as any).ɵdir?.exportAs;
    expect(exportAs).toContain('etNotificationAction');
  });
});
