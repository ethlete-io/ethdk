import { describe, expect, it } from 'vitest';
import { CollectedEvent } from '../model/event';
import { mergeDayEvents } from '../stream/merge-day-events';
import { streamDay } from '../stream/stream-day';
import { frozenDayPeerBands } from './frozen-rows';
import { ReviewedRow } from './model';
import { mapPeerDayRows, peerDayRowsOf } from './peer-rows';

const PC_SDK = '/home/human/dev/ethlete-sdk';
const PC_3D = '/home/human/dev/3d-projekte';
const MAC_SDK = '/Users/human/code/ethlete-sdk';
const PC = { machineId: 'pc-id', machineName: 'tank' };
const PC_KEYS = { [PC_SDK]: 'gitlab.com/ethlete/sdk', [PC_3D]: '3d-projekte' };
const MAC_KEYS = { [MAC_SDK]: 'gitlab.com/ethlete/sdk' };

const AT = (minutes: number) => new Date(new Date(2026, 10, 18, 9, 0, 0).getTime() + minutes * 60_000);

const focusRun = (options: { from: number; to: number; title: string }): CollectedEvent[] =>
  Array.from({ length: options.to - options.from + 1 }, (_, offset) => ({
    at: AT(options.from + offset),
    source: 'window' as const,
    kind: 'window-focus' as const,
    appId: 'code',
    title: options.title,
  }));

const commit = (minutes: number, repoPath: string, sha: string): CollectedEvent => ({
  at: AT(minutes),
  source: 'git',
  kind: 'git-commit',
  repoPath,
  branch: 'next',
  sha,
  subject: `feat: ${sha}`,
});

const reviewed = (rows: ReturnType<typeof streamDay>['rows']): ReviewedRow[] =>
  [...rows.proposals, ...rows.unnamed].map((row) => ({ ...row, state: 'suggested', edited: false, hidden: false }));

const macDay = streamDay({
  events: mergeDayEvents({
    local: [...focusRun({ from: 0, to: 60, title: 'ethlete-sdk - Code' }), commit(30, MAC_SDK, 'm1')],
    received: {
      events: [...focusRun({ from: 120, to: 240, title: '3d-projekte - Code' }), commit(180, PC_3D, 'p1')].map(
        (event) => ({ ...PC, event }),
      ),
      repoKeys: { [PC.machineId]: PC_KEYS },
    },
    keys: MAC_KEYS,
    rules: [],
  }),
  options: { repoRoots: [MAC_SDK] },
});

const macSends = peerDayRowsOf({
  day: '2026-11-18',
  frozen: false,
  rows: reviewed(macDay.rows),
  ownLanes: macDay.ownLanes,
  ledger: [],
  standInNames: {},
});

describe('the rows a paired machine sends back', () => {
  it('reads the received checkout as a lane of the merged day', () => {
    expect(reviewed(macDay.rows).some((row) => row.laneKey === `repo:${PC_3D}`)).toBe(true);
  });

  it('holds no row that only the receiving machine’s evidence built', () => {
    expect(macSends.rows.map((row) => row.laneKey)).not.toContain(`repo:${PC_3D}`);
    expect(macSends.rows.map((row) => row.laneKey)).toContain(`repo:${MAC_SDK}`);
  });

  it('draws no band of the paired machine in a checkout only this machine worked in', () => {
    const echoed = {
      ...macSends,
      rows: [
        ...macSends.rows,
        { laneKey: `repo:${PC_3D}`, from: AT(120), to: AT(240), description: '', state: 'suggested' as const },
      ],
    };
    const onPc = mapPeerDayRows({ rows: echoed, peerKeys: MAC_KEYS, localKeys: PC_KEYS });
    const empty = { proposals: [], unattributed: [], unnamed: [], calls: [] } as unknown as ReturnType<
      typeof streamDay
    >['rows'];
    const bands = frozenDayPeerBands({
      frozen: empty,
      current: { rows: empty, peerLanes: {} },
      peerRows: { 'mac-id': onPc },
      machineNames: { 'mac-id': 'MacBook' },
      foreignIssues: [],
    });

    expect(bands.map((band) => band.laneKey)).toEqual([`repo:${PC_SDK}`]);
  });
});
