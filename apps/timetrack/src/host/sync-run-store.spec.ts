import { SyncRunRecord, parseSyncRun, toStoredSyncRun } from './sync-run-store';

const throughJson = (run: SyncRunRecord) => parseSyncRun(JSON.parse(JSON.stringify(toStoredSyncRun(run))));

describe('sync run store', () => {
  it('reads back a written run with the reason a row did not land', () => {
    const run: SyncRunRecord = {
      kind: 'written',
      unrecorded: null,
      rows: [
        { kind: 'create', proposalId: 'p1', status: 'written', tempoWorklogId: '42' },
        { kind: 'update', proposalId: 'p2', status: 'failed', error: new Error('Tempo rejected the token (401)') },
        { kind: 'create', proposalId: 'p3', status: 'blocked', missingDescription: true },
      ],
    };

    const read = throughJson(run);

    expect(read).toEqual({
      kind: 'written',
      unrecorded: null,
      rows: [
        { kind: 'create', proposalId: 'p1', status: 'written', tempoWorklogId: '42' },
        { kind: 'update', proposalId: 'p2', status: 'failed', error: expect.any(Error) },
        { kind: 'create', proposalId: 'p3', status: 'blocked', missingDescription: true },
      ],
    });
    expect(read?.kind === 'written' && read.rows[1]?.error?.message).toBe('Tempo rejected the token (401)');
  });

  it('reads back a run that wrote nothing', () => {
    expect(throughJson({ kind: 'failed', message: 'Tempo needs its own API token in Settings.' })).toEqual({
      kind: 'failed',
      message: 'Tempo needs its own API token in Settings.',
    });
  });

  it('drops a document it cannot read', () => {
    expect(parseSyncRun(null)).toBeNull();
    expect(parseSyncRun({ kind: 'written', rows: [{ kind: 'create' }] })).toEqual({
      kind: 'written',
      rows: [],
      unrecorded: null,
    });
  });
});
