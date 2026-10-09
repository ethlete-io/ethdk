import { describe, expect, it } from 'vitest';
import { ReviewedRow } from './model';
import {
  PEER_DAY_ROWS_VERSION,
  PeerDayRows,
  encodePeerDayRows,
  mapPeerDayRows,
  parsePeerDayRows,
  peerDayRowsOf,
  peerDayRowsToBackfill,
  peerDayRowsVersionOf,
} from './peer-rows';

const at = (time: string) => new Date(`2026-10-08T${time}:00Z`);

const row = (
  options: Partial<Omit<ReviewedRow, 'from' | 'to'>> & { id: string; from: string; to: string },
): ReviewedRow => ({
  durationMs: 0,
  observedMs: 0,
  description: '',
  confidence: 'certain',
  evidence: [],
  state: 'suggested',
  edited: false,
  hidden: false,
  ...options,
  from: at(options.from),
  to: at(options.to),
});

const SPECS = 'repo:/Users/tom/dev/fifagg-specs';

describe('the rows a machine sends of its day', () => {
  const sent = peerDayRowsOf({
    day: '2026-10-08',
    frozen: true,
    rows: [
      row({ id: 'a', from: '13:15', to: '15:00', laneKey: SPECS, issueKey: 'FIFAGG-12657', description: 'Specs' }),
      row({ id: 'b', from: '15:00', to: '16:00', laneKey: SPECS, standInId: 's-1', state: 'edited' }),
      row({ id: 'c', from: '16:00', to: '16:30', laneKey: SPECS }),
      row({ id: 'd', from: '16:30', to: '17:00', laneKey: SPECS, unattended: true }),
      row({ id: 'e', from: '17:00', to: '17:30', laneKey: 'app:com.apple.loginwindow' }),
      row({ id: 'f', from: '17:30', to: '18:00' }),
    ],
    ledger: [{ proposalId: 'a', day: '2026-10-08', tempoWorklogId: 'w-9', contentHash: 'h', syncedAt: at('19:00') }],
    standInNames: { 's-1': 'Bracket spike' },
  });

  it('holds each attended repository row with its name, state and worklog, and no evidence', () => {
    expect(sent).toEqual({
      day: '2026-10-08',
      frozen: true,
      rows: [
        {
          laneKey: SPECS,
          from: at('13:15'),
          to: at('15:00'),
          issueKey: 'FIFAGG-12657',
          description: 'Specs',
          state: 'booked',
          worklogId: 'w-9',
        },
        {
          laneKey: SPECS,
          from: at('15:00'),
          to: at('16:00'),
          standInName: 'Bracket spike',
          description: '',
          state: 'accepted',
        },
        { laneKey: SPECS, from: at('16:00'), to: at('16:30'), description: '', state: 'suggested' },
      ],
    });
  });

  it('reads back what it wrote, and nothing from what no version wrote', () => {
    expect(parsePeerDayRows(encodePeerDayRows(sent))).toEqual(sent);
    expect(parsePeerDayRows('not json')).toBeNull();
    expect(parsePeerDayRows('{"day":"2026-10-08"}')).toBeNull();
    expect(
      parsePeerDayRows(
        '{"day":"2026-10-08","rows":[{"laneKey":"repo:/a","from":2,"to":1},{"laneKey":"repo:/a","from":1,"to":2,"state":"x"}]}',
      ),
    ).toEqual({
      day: '2026-10-08',
      frozen: false,
      rows: [{ laneKey: 'repo:/a', from: new Date(1), to: new Date(2), description: '', state: 'suggested' }],
    });
  });
});

describe('a paired machine’s rows on this machine', () => {
  it('moves each lane onto the local checkout of the same repository', () => {
    const rows: PeerDayRows = {
      day: '2026-10-08',
      frozen: true,
      rows: [
        { laneKey: SPECS, from: at('13:15'), to: at('15:00'), description: '', state: 'booked' },
        {
          laneKey: 'repo:/Users/tom/dev/elsewhere',
          from: at('15:00'),
          to: at('16:00'),
          description: '',
          state: 'suggested',
        },
      ],
    };

    expect(
      mapPeerDayRows({
        rows,
        peerKeys: { '/Users/tom/dev/fifagg-specs': 'gitlab.com/fifagg/specs' },
        localKeys: { '/home/tom/dev/specs': 'gitlab.com/fifagg/specs' },
      }).rows.map((mapped) => mapped.laneKey),
    ).toEqual(['repo:/home/tom/dev/specs', 'repo:/Users/tom/dev/elsewhere']);
  });
});

describe('the booked days a machine builds its rows for again', () => {
  const current = encodePeerDayRows({ day: '2026-10-07', frozen: true, rows: [] });

  it('stamps what it sends with the version that built it', () => {
    expect(peerDayRowsVersionOf(current)).toBe(PEER_DAY_ROWS_VERSION);
    expect(peerDayRowsVersionOf('{"day":"2026-10-07","frozen":true,"rows":[]}')).toBe(0);
    expect(peerDayRowsVersionOf('not json')).toBe(0);
  });

  it('takes each booked day it stored no rows for, or rows an older version built, oldest first', () => {
    expect(
      peerDayRowsToBackfill({
        bookedDays: ['2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-08'],
        stored: {
          '2026-10-07': current,
          '2026-10-06': '{"day":"2026-10-06","frozen":true,"rows":[]}',
          '2026-10-04': '{"day":"2026-10-04","frozen":true,"rows":[]}',
        },
      }),
    ).toEqual(['2026-10-05', '2026-10-06', '2026-10-08']);
  });
});
