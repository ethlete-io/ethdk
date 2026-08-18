import { devtoolsProbeLockName, probeClientId, summarizeLocks } from './query-devtools-locks';

const info = (name: string, clientId: string): LockInfo => ({ name, clientId, mode: 'exclusive' });

const snapshotOf = (options: { held?: LockInfo[]; pending?: LockInfo[] }): LockManagerSnapshot => ({
  held: options.held ?? [],
  pending: options.pending ?? [],
});

describe('summarizeLocks', () => {
  it('should decode an auth refresh lock to the provider whose token is being spent', () => {
    const [row] = summarizeLocks({
      snapshot: snapshotOf({ held: [info('ethlete-auth:refresh:main', 'a')] }),
      clientId: 'a',
    });

    expect(row).toMatchObject({ kind: 'auth', label: 'main refresh' });
  });

  it('should decode an auth leader lock to the provider it elects for', () => {
    const rows = summarizeLocks({
      snapshot: snapshotOf({ held: [info('ethlete-auth:leader:main', 'a')] }),
      clientId: 'a',
    });

    expect(rows).toEqual([
      {
        name: 'ethlete-auth:leader:main',
        label: 'main',
        kind: 'auth',
        channel: null,
        tabs: 1,
        standing: 'holder',
        queuePlace: null,
      },
    ]);
  });

  it('should split a poll lock into its channel and its cache key', () => {
    const [row] = summarizeLocks({
      snapshot: snapshotOf({ held: [info('et-query-poll:api:GET/teams', 'a')] }),
      clientId: 'a',
    });

    expect(row?.kind).toBe('poll');
    expect(row?.channel).toBe('api');
    expect(row?.label).toBe('GET/teams');
  });

  it('should keep a name it cannot decode as the label', () => {
    const [row] = summarizeLocks({ snapshot: snapshotOf({ held: [info('app-thing', 'a')] }), clientId: 'a' });

    expect(row?.kind).toBe('other');
    expect(row?.label).toBe('app-thing');
  });

  it('should count held plus queued as the number of tabs taking part', () => {
    const [row] = summarizeLocks({
      snapshot: snapshotOf({
        held: [info('ethlete-auth:leader:main', 'a')],
        pending: [info('ethlete-auth:leader:main', 'b'), info('ethlete-auth:leader:main', 'c')],
      }),
      clientId: 'a',
    });

    expect(row?.tabs).toBe(3);
  });

  it('should report this tab as queued at its place in line', () => {
    const [row] = summarizeLocks({
      snapshot: snapshotOf({
        held: [info('ethlete-auth:leader:main', 'a')],
        pending: [info('ethlete-auth:leader:main', 'b'), info('ethlete-auth:leader:main', 'me')],
      }),
      clientId: 'me',
    });

    expect(row?.standing).toBe('queued');
    expect(row?.queuePlace).toBe(2);
  });

  it('should report a lock this tab is not taking part in as absent', () => {
    const [row] = summarizeLocks({
      snapshot: snapshotOf({ held: [info('ethlete-auth:leader:main', 'a')] }),
      clientId: 'me',
    });

    expect(row?.standing).toBe('absent');
    expect(row?.queuePlace).toBeNull();
  });

  it('should report every standing as unknown without a client id', () => {
    const rows = summarizeLocks({
      snapshot: snapshotOf({ held: [info('ethlete-auth:leader:main', 'a')] }),
      clientId: null,
    });

    expect(rows[0]?.standing).toBe('unknown');
  });

  it('should drop the probe locks every open panel holds', () => {
    const rows = summarizeLocks({
      snapshot: snapshotOf({
        held: [info(devtoolsProbeLockName('mine'), 'me'), info(devtoolsProbeLockName('theirs'), 'other')],
      }),
      clientId: 'me',
    });

    expect(rows).toEqual([]);
  });

  it('should order auth locks before poll locks before anything else', () => {
    const rows = summarizeLocks({
      snapshot: snapshotOf({
        held: [info('app-thing', 'a'), info('et-query-poll:api:GET/teams', 'a'), info('ethlete-auth:leader:main', 'a')],
      }),
      clientId: 'a',
    });

    expect(rows.map((row) => row.kind)).toEqual(['auth', 'poll', 'other']);
  });
});

describe('probeClientId', () => {
  it('should read this tab id off the probe lock it holds', () => {
    const name = devtoolsProbeLockName('mine');

    expect(probeClientId(snapshotOf({ held: [info(name, 'me')] }), name)).toBe('me');
  });

  it('should be null while the probe is still queued rather than held', () => {
    const name = devtoolsProbeLockName('mine');

    expect(probeClientId(snapshotOf({ pending: [info(name, 'me')] }), name)).toBeNull();
  });
});
