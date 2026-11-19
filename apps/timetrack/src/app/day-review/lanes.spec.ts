import { PeerBand } from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';
import { isPeerLaneKey, lanesOf, peerBandLabel } from './lanes';

const SDK = 'repo:/home/human/dev/ethlete-sdk';
const MODELS = 'repo:/home/human/dev/3d-projekte';
const DAY = new Date(2026, 10, 18);
const AT = (hour: number) => new Date(2026, 10, 18, hour);

const band = (laneKey: string, from: number, to: number): PeerBand => ({
  from: AT(from),
  to: AT(to),
  machineId: 'mac-id',
  machineName: 'MacBook',
  laneKey,
  booked: false,
});

describe('a paired machine’s band on the day', () => {
  const lanes = lanesOf({
    blocks: [],
    breaks: [],
    behind: [{ from: AT(9), to: AT(10), issueKey: 'SDK-1', laneKey: SDK }],
    peers: [band(SDK, 10, 11), band(MODELS, 11, 12)],
    dayStart: DAY,
  });

  it('never shares a lane with the blocks of a checkout this machine has', () => {
    const sdk = lanes.find((lane) => lane.key === SDK);

    expect(sdk?.peers).toEqual([]);
  });

  it('opens no lane of its own checkout, and sits in one lane of its machine instead', () => {
    expect(lanes.map((lane) => lane.key)).not.toContain(MODELS);

    const machine = lanes.find((lane) => isPeerLaneKey(lane.key));

    expect(machine?.label).toBe('MacBook');
    expect(machine?.peers.map((placed) => peerBandLabel(placed))).toEqual([
      'Worked on MacBook',
      'Worked on MacBook · 3d-projekte',
    ]);
    expect(lanes.at(-1)).toBe(machine);
  });
});
