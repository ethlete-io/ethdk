import '../../test-helpers';
import { NOTIFICATION_STATUS } from './notification-config';

describe('NOTIFICATION_STATUS', () => {
  it('exports all status values', () => {
    expect(NOTIFICATION_STATUS).toHaveProperty('LOADING');
    expect(NOTIFICATION_STATUS).toHaveProperty('SUCCESS');
    expect(NOTIFICATION_STATUS).toHaveProperty('ERROR');
    expect(NOTIFICATION_STATUS).toHaveProperty('INFO');
  });

  it('has correct status string values', () => {
    expect(NOTIFICATION_STATUS.LOADING).toBe('loading');
    expect(NOTIFICATION_STATUS.SUCCESS).toBe('success');
    expect(NOTIFICATION_STATUS.ERROR).toBe('error');
    expect(NOTIFICATION_STATUS.INFO).toBe('info');
  });

  it('has 4 status entries', () => {
    expect(Object.keys(NOTIFICATION_STATUS)).toHaveLength(4);
  });
});
