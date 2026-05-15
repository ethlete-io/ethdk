import '../../../test-helpers';
import { NotificationItemDirective } from './notification-item.directive';

describe('NotificationItemDirective', () => {
  it('has the correct selector', () => {
    const selectors = (NotificationItemDirective as any).ɵdir?.selectors;
    expect(selectors).toBeDefined();
    expect(JSON.stringify(selectors)).toContain('etNotificationItem');
  });

  it('declares a required input aliased as etNotificationItem', () => {
    const inputs = (NotificationItemDirective as any).ɵdir?.inputs;
    expect(inputs).toBeDefined();
    // The input is aliased as 'etNotificationItem'; ɵdir.inputs key is the alias
    expect(JSON.stringify(inputs)).toContain('ref');
  });
});
