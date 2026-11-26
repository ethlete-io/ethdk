import { BehindStretch, PeerBand, TimetrackProjectLink } from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';
import { isPeerLaneKey, laneColumnOf, laneTitleOf, lanesOf, peerBandLabel, peerLabelKey } from './lanes';

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

describe('a project is one lane', () => {
  const API = 'repo:/home/human/dev/api';
  const WEB = 'repo:/home/human/dev/web';
  const SIDE = 'repo:/home/human/dev/side';
  const API_TREE = 'repo:/home/human/dev/api-tree';

  const link = (path: string, target: TimetrackProjectLink['target']): TimetrackProjectLink => ({
    id: path,
    path,
    target,
    createdAt: new Date(2026, 0, 1),
  });

  const stretch = (laneKey: string): BehindStretch => ({ from: AT(9), to: AT(10), issueKey: 'FIP-1', laneKey });

  const lanes = (options: { keys: string[]; links: TimetrackProjectLink[]; worktrees?: Record<string, string> }) =>
    lanesOf({
      blocks: [],
      breaks: [],
      behind: options.keys.map(stretch),
      dayStart: DAY,
      columnOf: laneColumnOf({ worktrees: options.worktrees ?? {}, links: options.links }),
    }).filter((lane) => lane.key !== 'lane:break');

  const project = link('/home/human/dev/api', { kind: 'project', projectKey: 'FIP' });

  it('draws two checkouts linked to one project in one lane labelled with the key', () => {
    const both = [project, link('/home/human/dev/web', { kind: 'project', projectKey: 'FIP' })];
    const drawn = lanes({ keys: [API, WEB], links: both });

    expect(drawn.map((lane) => [lane.key, lane.label])).toEqual([['project:FIP', 'FIP']]);
  });

  it('names the checkouts of a project lane in its title', () => {
    const both = [project, link('/home/human/dev/web', { kind: 'project', projectKey: 'FIP' })];
    const drawn = lanes({ keys: [API, WEB, SIDE], links: both });

    expect(drawn.map(laneTitleOf).sort()).toEqual(['api, web', SIDE]);
  });

  it('keeps a checkout with no link in its own lane', () => {
    const drawn = lanes({ keys: [API, SIDE], links: [project] });

    expect(drawn.map((lane) => lane.label).sort()).toEqual(['FIP', 'side']);
  });

  it('keeps a checkout with a private link in its own lane', () => {
    const drawn = lanes({ keys: [API, SIDE], links: [project, link('/home/human/dev/side', { kind: 'private' })] });

    expect(drawn.map((lane) => lane.key).sort()).toEqual(['project:FIP', SIDE]);
  });

  it('draws a worktree of a linked checkout in the project lane', () => {
    const drawn = lanes({
      keys: [API, API_TREE],
      links: [project],
      worktrees: { '/home/human/dev/api-tree': '/home/human/dev/api' },
    });

    expect(drawn.map((lane) => lane.key)).toEqual(['project:FIP']);
  });

  it('never maps a lane that holds no checkout', () => {
    const column = laneColumnOf({ worktrees: {}, links: [project] });

    expect(['lane:call', 'lane:timer', 'lane:none', 'app:slack'].map(column)).toEqual([
      'lane:call',
      'lane:timer',
      'lane:none',
      'app:slack',
    ]);
  });
});
