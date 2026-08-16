import { describe, expect, it } from 'vitest';
import { SyncedWorklog } from '../model/proposal';
import {
  TempoMarkerScheme,
  applyWorklogMarker,
  markedProposalId,
  readDescriptionMarker,
  recoverLedgerFromMarkers,
  stripDescriptionMarker,
  unmarkedDescription,
} from './marker';
import { TempoWorklog } from './worklogs';

const PROPOSAL_ID = 'FIP-3010@2026-08-11T07:00:00.000Z';
const ATTRIBUTE: TempoMarkerScheme = { kind: 'attribute', attributeKey: '_TimetrackId_' };
const SUFFIX: TempoMarkerScheme = { kind: 'description-suffix' };
const SYNCED_AT = new Date(2026, 7, 11, 18, 0);

const worklog = (overrides: Partial<TempoWorklog> = {}): TempoWorklog => ({
  id: 'w1',
  issueId: '10100',
  authorAccountId: 'acc:123',
  from: new Date(2026, 7, 11, 9, 0),
  durationMs: 3_600_000,
  billableMs: 0,
  description: 'Logout on idle',
  attributes: {},
  ...overrides,
});

describe('applyWorklogMarker', () => {
  it('stores the proposal id in the configured attribute, leaving the description alone', () => {
    const applied = applyWorklogMarker({ description: 'Logout on idle', proposalId: PROPOSAL_ID, scheme: ATTRIBUTE });

    expect(applied.description).toBe('Logout on idle');
    expect(applied.attributes).toEqual({ _TimetrackId_: PROPOSAL_ID });
  });

  it('keeps the attribute values the caller supplied', () => {
    const applied = applyWorklogMarker({
      description: 'Logout on idle',
      proposalId: PROPOSAL_ID,
      scheme: ATTRIBUTE,
      attributes: { _Billable_: true },
    });

    expect(applied.attributes).toEqual({ _Billable_: true, _TimetrackId_: PROPOSAL_ID });
  });

  it('appends a tag to the description when no attribute can hold the id', () => {
    const applied = applyWorklogMarker({ description: 'Logout on idle', proposalId: PROPOSAL_ID, scheme: SUFFIX });

    expect(applied.description).toBe(`Logout on idle [et:${PROPOSAL_ID}]`);
    expect(applied.attributes).toEqual({});
  });

  it('is idempotent, so a re-sync does not stack markers', () => {
    const once = applyWorklogMarker({ description: 'Logout on idle', proposalId: PROPOSAL_ID, scheme: SUFFIX });
    const twice = applyWorklogMarker({ description: once.description, proposalId: PROPOSAL_ID, scheme: SUFFIX });

    expect(twice.description).toBe(once.description);
  });

  it('marks an empty description without a leading space', () => {
    expect(applyWorklogMarker({ description: '', proposalId: 'p1', scheme: SUFFIX }).description).toBe('[et:p1]');
  });

  it('writes no marker at all without a scheme', () => {
    const applied = applyWorklogMarker({ description: 'Logout on idle', proposalId: PROPOSAL_ID });

    expect(applied.description).toBe('Logout on idle');
    expect(applied.attributes).toEqual({});
  });
});

describe('readDescriptionMarker', () => {
  it('reads back what the suffix scheme wrote', () => {
    const marked = applyWorklogMarker({ description: 'Logout on idle', proposalId: PROPOSAL_ID, scheme: SUFFIX });

    expect(readDescriptionMarker(marked.description)).toBe(PROPOSAL_ID);
  });

  it('ignores a tag that is not at the end', () => {
    expect(readDescriptionMarker('[et:p1] and then some')).toBeUndefined();
  });
});

describe('stripDescriptionMarker', () => {
  it('leaves an unmarked description untouched', () => {
    expect(stripDescriptionMarker('Logout on idle')).toBe('Logout on idle');
  });

  it('removes the tag and the space before it', () => {
    expect(stripDescriptionMarker('Logout on idle [et:p1]')).toBe('Logout on idle');
  });
});

describe('markedProposalId', () => {
  it('reads the attribute under the attribute scheme', () => {
    expect(markedProposalId({ worklog: worklog({ attributes: { _TimetrackId_: 'p1' } }), scheme: ATTRIBUTE })).toBe(
      'p1',
    );
  });

  it('treats an empty attribute value as unmarked', () => {
    expect(
      markedProposalId({ worklog: worklog({ attributes: { _TimetrackId_: '' } }), scheme: ATTRIBUTE }),
    ).toBeUndefined();
  });

  it('reads the description under the suffix scheme', () => {
    expect(markedProposalId({ worklog: worklog({ description: 'Work [et:p1]' }), scheme: SUFFIX })).toBe('p1');
  });

  it('does not read a description marker when the scheme is the attribute', () => {
    expect(markedProposalId({ worklog: worklog({ description: 'Work [et:p1]' }), scheme: ATTRIBUTE })).toBeUndefined();
  });
});

describe('unmarkedDescription', () => {
  it('takes the suffix back off', () => {
    expect(unmarkedDescription({ worklog: worklog({ description: 'Work [et:p1]' }), scheme: SUFFIX })).toBe('Work');
  });

  it('leaves the text alone under the other schemes', () => {
    expect(unmarkedDescription({ worklog: worklog({ description: 'Work [et:p1]' }), scheme: ATTRIBUTE })).toBe(
      'Work [et:p1]',
    );
  });
});

describe('recoverLedgerFromMarkers', () => {
  it('adopts a marked worklog the ledger no longer knows about', () => {
    const recovery = recoverLedgerFromMarkers({
      worklogs: [worklog({ id: 'w9', attributes: { _TimetrackId_: 'p1' } })],
      scheme: ATTRIBUTE,
      syncedAt: SYNCED_AT,
    });

    expect(recovery.recovered).toEqual<SyncedWorklog[]>([
      { proposalId: 'p1', day: '2026-08-11', tempoWorklogId: 'w9', contentHash: '', syncedAt: SYNCED_AT },
    ]);
  });

  it('leaves the hash empty so the next sync re-asserts the content', () => {
    const recovery = recoverLedgerFromMarkers({
      worklogs: [worklog({ attributes: { _TimetrackId_: 'p1' } })],
      scheme: ATTRIBUTE,
    });

    expect(recovery.recovered[0]?.contentHash).toBe('');
  });

  it('skips proposals the ledger already covers', () => {
    const recovery = recoverLedgerFromMarkers({
      worklogs: [worklog({ attributes: { _TimetrackId_: 'p1' } })],
      scheme: ATTRIBUTE,
      ledger: [{ proposalId: 'p1', day: '2026-08-11', tempoWorklogId: 'w1', contentHash: 'abc', syncedAt: SYNCED_AT }],
    });

    expect(recovery.recovered).toEqual([]);
  });

  it('adopts neither worklog when two claim the same proposal', () => {
    const recovery = recoverLedgerFromMarkers({
      worklogs: [
        worklog({ id: 'w1', attributes: { _TimetrackId_: 'p1' } }),
        worklog({ id: 'w2', attributes: { _TimetrackId_: 'p1' } }),
      ],
      scheme: ATTRIBUTE,
    });

    expect(recovery.recovered).toEqual([]);
    expect(recovery.ambiguous).toEqual(['p1']);
  });

  it('recovers nothing when no marker is written', () => {
    const recovery = recoverLedgerFromMarkers({
      worklogs: [worklog({ description: 'Work [et:p1]', attributes: { _TimetrackId_: 'p1' } })],
      scheme: { kind: 'none' },
    });

    expect(recovery).toEqual({ recovered: [], ambiguous: [] });
  });
});
