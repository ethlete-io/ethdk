import { describe, expect, it } from 'vitest';
import { ActivityBlock, ActivityContext } from '../model/block';
import { dropNoWorkContext } from './no-work-context';

const AT = (minutes: number) => new Date(new Date(2026, 8, 10, 9, 0, 0).getTime() + minutes * 60_000);

const block = (options: { fromMinute: number; toMinute: number; context: ActivityContext }): ActivityBlock => ({
  from: AT(options.fromMinute),
  to: AT(options.toMinute),
  context: options.context,
  evidence: [],
});

const SDK = '/home/tom/dev/ethlete-sdk';

describe('dropNoWorkContext', () => {
  it('keeps every block when neither list holds anything', () => {
    const blocks = [block({ fromMinute: 0, toMinute: 10, context: { appId: 'spotify' } })];

    expect(dropNoWorkContext({ blocks })).toEqual(blocks);
  });

  it('drops a block that names nothing but an application on the list', () => {
    const kept = dropNoWorkContext({
      blocks: [
        block({ fromMinute: 0, toMinute: 10, context: { appId: 'code', repoPath: SDK } }),
        block({ fromMinute: 10, toMinute: 40, context: { appId: 'spotify' } }),
      ],
      apps: ['Spotify'],
    });

    expect(kept.map((entry) => entry.context.appId)).toEqual(['code']);
  });

  it('keeps a block of a listed application that named a checkout', () => {
    const kept = dropNoWorkContext({
      blocks: [block({ fromMinute: 0, toMinute: 10, context: { appId: 'spotify', repoPath: SDK } })],
      apps: ['spotify'],
    });

    expect(kept).toHaveLength(1);
  });

  it('gives a short dialog the context of the block it opened over', () => {
    const kept = dropNoWorkContext({
      blocks: [
        block({ fromMinute: 0, toMinute: 10, context: { appId: 'code', repoPath: SDK } }),
        block({ fromMinute: 10, toMinute: 10.5, context: { appId: 'xdg-desktop-portal-gnome' } }),
        block({ fromMinute: 10.5, toMinute: 30, context: { appId: 'code', repoPath: SDK } }),
      ],
      transientApps: ['xdg-desktop-portal-gnome'],
    });

    expect(kept).toHaveLength(3);
    expect(kept.map((entry) => entry.context.repoPath)).toEqual([SDK, SDK, SDK]);
  });

  it('drops a dialog that opened over nothing', () => {
    const kept = dropNoWorkContext({
      blocks: [
        block({ fromMinute: 0, toMinute: 10, context: { appId: 'code', repoPath: SDK } }),
        block({ fromMinute: 10, toMinute: 10.5, context: { appId: 'xdg-desktop-portal-gnome' } }),
      ],
      transientApps: ['xdg-desktop-portal-gnome'],
    });

    expect(kept).toHaveLength(1);
  });

  it('drops a dialog whose two sides are different work', () => {
    const kept = dropNoWorkContext({
      blocks: [
        block({ fromMinute: 0, toMinute: 10, context: { appId: 'code', repoPath: SDK } }),
        block({ fromMinute: 10, toMinute: 10.5, context: { appId: 'xdg-desktop-portal-gnome' } }),
        block({ fromMinute: 10.5, toMinute: 30, context: { appId: 'code', repoPath: '/home/tom/dev/other' } }),
      ],
      transientApps: ['xdg-desktop-portal-gnome'],
    });

    expect(kept).toHaveLength(2);
  });

  it('drops a dialog that outlasted the transient limit rather than giving it the work', () => {
    const kept = dropNoWorkContext({
      blocks: [
        block({ fromMinute: 0, toMinute: 10, context: { appId: 'code', repoPath: SDK } }),
        block({ fromMinute: 10, toMinute: 40, context: { appId: 'xdg-desktop-portal-gnome' } }),
        block({ fromMinute: 40, toMinute: 60, context: { appId: 'code', repoPath: SDK } }),
      ],
      transientApps: ['xdg-desktop-portal-gnome'],
      maxTransientMs: 5 * 60_000,
    });

    expect(kept).toHaveLength(2);
  });
});
