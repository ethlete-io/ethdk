import { InjectionToken } from '@angular/core';
import '../../test-helpers';
import { NOTIFICATION_STACK_CONTEXT_TOKEN } from './notification-stack-context.token';

describe('NOTIFICATION_STACK_CONTEXT_TOKEN', () => {
  it('is an InjectionToken instance', () => {
    expect(NOTIFICATION_STACK_CONTEXT_TOKEN).toBeInstanceOf(InjectionToken);
  });

  it('has the NOTIFICATION_STACK_CONTEXT_TOKEN description', () => {
    expect(NOTIFICATION_STACK_CONTEXT_TOKEN.toString()).toContain('NOTIFICATION_STACK_CONTEXT_TOKEN');
  });
});
