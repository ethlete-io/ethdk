import { PeerBand } from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';
import { isPeerLaneKey, lanesOf, peerBandLabel, peerLabelKey } from './lanes';

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

  it('sits in the lane of its checkout when this machine has one', () => {
    const sdk = lanes.find((lane) => lane.key === SDK);

    expect(sdk?.peers.map((placed) => peerBandLabel(placed))).toEqual(['Worked on MacBook']);
  });

  it('opens no lane of its own checkout, and sits in one lane of its machine instead', () => {
    expect(lanes.map((lane) => lane.key)).not.toContain(MODELS);

    const machine = lanes.find((lane) => isPeerLaneKey(lane.key));

    expect(machine?.label).toBe('MacBook');
    expect(machine?.peers.map((placed) => peerBandLabel(placed))).toEqual(['Worked on MacBook · 3d-projekte']);
    expect(lanes.at(-1)).toBe(machine);
  });
});

describe('the labels of bands that share a column', () => {
  const quarter = (from: number, to: number): PeerBand => ({
    ...band(SDK, 0, 0),
    from: new Date(2026, 10, 18, 9, from),
    to: new Date(2026, 10, 18, 9, to),
  });
  const labelSpan = (30 / (24 * 60)) * 100;

  const hiddenIn = (peers: PeerBand[], span?: number) =>
    lanesOf({
      blocks: [],
      breaks: [],
      behind: [{ from: AT(8), to: AT(9), issueKey: 'SDK-1', laneKey: SDK }],
      peers,
      dayStart: DAY,
      labelSpan: span,
    }).find((lane) => lane.key === SDK)?.hiddenLabels;

  it('hides the label of a band that starts under the label above it', () => {
    const peers = [quarter(0, 30), quarter(10, 40)];
    const lane = lanesOf({
      blocks: [],
      breaks: [],
      behind: [{ from: AT(8), to: AT(9), issueKey: 'SDK-1', laneKey: SDK }],
      peers,
      dayStart: DAY,
      labelSpan,
    });
    const placed = lane.find((it) => it.key === SDK)?.peers ?? [];

    expect(hiddenIn(peers, labelSpan)?.has(peerLabelKey(placed[0]!))).toBe(false);
    expect(hiddenIn(peers, labelSpan)?.has(peerLabelKey(placed[1]!))).toBe(true);
  });

  it('keeps stacked bands that touch but do not overlap', () => {
    expect(hiddenIn([quarter(0, 30), quarter(30, 60)], labelSpan)?.size).toBe(0);
  });

  it('hides nothing when no label height is given', () => {
    expect(hiddenIn([quarter(0, 30), quarter(10, 40)])?.size).toBe(0);
  });
});
