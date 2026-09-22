import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { BearerAuthProviderFeatureContext } from '../bearer-auth-provider';
import { withBearerAuthMultiTabSync } from './bearer-auth-multi-tab-sync';

const contextFor = (name: string) =>
  ({ name, isTabLocalSession: signal(false).asReadonly() }) as unknown as BearerAuthProviderFeatureContext<unknown, []>;

describe('withBearerAuthMultiTabSync', () => {
  it('falls back to a single-tab leader on the default channel when setup runs without earlySetup', () => {
    const feature = withBearerAuthMultiTabSync()(contextFor('lonely'));

    expect(feature.instance.leadership).toBe('off');
    expect(feature.instance.isLeader()).toBe(true);
    expect(feature.instance.instanceCount()).toBe(1);
    expect(feature.devtools()[0]).toEqual({ label: 'channel', value: 'ethlete-auth-sync:lonely' });
  });

  it('keeps a configured channel name in that fallback', () => {
    const feature = withBearerAuthMultiTabSync({ channelName: 'custom' })(contextFor('lonely'));

    expect(feature.devtools()[0]).toEqual({ label: 'channel', value: 'custom' });
  });
});
