/**
 * The Kerbe material, straight from the brand sheet in `plans/timetrack/design-explore`.
 * Design sketches only - nothing here is registered as an app theme yet.
 */
export const KERBE_VARS = `
  --k-ground:#0A0D0E;
  --k-panel:#12171A;
  --k-panel-hi:#171E22;
  --k-ink:#EFE9DA;
  --k-ink-2:#A9A192;
  --k-ink-3:#8C8676;
  --k-brass:#D6B569;
  --k-brass-hi:#F0E0B4;
  --k-patina:#3FB39A;
  --k-oxide:#B04A3A;
  --k-sans:Jost,system-ui,sans-serif;
  --k-mono:'IBM Plex Mono',monospace;
  --k-display:'Josefin Sans',sans-serif;
`;

/** What a band asks of the reader. This, and not the matcher's confidence, sets how loud it is. */
export type BandAsk = 'nothing' | 'a glance' | 'an answer' | 'a ticket';

/** The four rebuilds under test. Each is a different answer to "what makes a band visible". */
export type BandTreatment = 'plate' | 'tally' | 'rule' | 'inlay';

export type BandKind = 'work' | 'background' | 'break';

/** How a run of touching plates is cut apart. Settled: `edge`. */
export type BandSeparator = 'edge' | 'gap' | 'alternate' | 'none';

/** How the one band too short for a padded row is drawn. Settled: `plain`. */
export type BandShrink = 'small' | 'plain' | 'timed';

/** What a band gives up in a lane too narrow for both. Under test in `Kerbe/Narrow lane`. */
export type BandNarrow = 'drop-time' | 'stack' | 'drop-label';

export type Band = {
  id: string;
  kind: BandKind;
  ask: BandAsk;
  from: string;
  minutes: number;
  label: string;
  detail?: string;
};

/** One real day, taken off the current app screen, so a treatment is judged as a column and not a chip. */
export const DAY: Band[] = [
  {
    id: 'a',
    kind: 'work',
    ask: 'nothing',
    from: '11:00',
    minutes: 165,
    label: 'ET-772',
    detail: 'fix(agent-rules): Fire the context warning',
  },
  { id: 'b', kind: 'background', ask: 'nothing', from: '13:45', minutes: 45, label: 'ET-772 · in the background' },
  {
    id: 'c',
    kind: 'work',
    ask: 'an answer',
    from: '14:30',
    minutes: 45,
    label: 'Not yet named',
    detail: 'feat(platform): Auto size the player item name',
  },
  {
    id: 'd',
    kind: 'work',
    ask: 'a glance',
    from: '15:15',
    minutes: 45,
    label: 'ET-772',
    detail: 'feat(repo): Answer the parent with the epic',
  },
  { id: 'e', kind: 'break', ask: 'nothing', from: '16:00', minutes: 30, label: 'Break' },
  {
    id: 'f',
    kind: 'work',
    ask: 'a ticket',
    from: '16:30',
    minutes: 75,
    label: 'Toty public fixes',
    detail: 'fix(toty-public): Correct the showcase layout',
  },
  {
    id: 'g',
    kind: 'work',
    ask: 'nothing',
    from: '17:45',
    minutes: 45,
    label: 'Not counted',
    detail: 'Open Room #1 · Discord',
  },
];

/** An all-day story: the parent of the rows under it, drawn in the strip above the axis. */
export type DayStory = {
  id: string;
  title: string;
  rows: number;
};

/** One checkout's column of the day, as the app draws it: a key, a label and the bands in it. */
export type DayLaneFixture = {
  key: string;
  label: string;
  /** The break lane carries no ticket and no gesture, so it stays narrow. */
  narrow?: boolean;
  bands: Band[];
};

/**
 * A full day, with the four lanes the app really draws, two overlaps inside one lane, and the
 * all-day strip. This is what a treatment has to survive before it can go into the app.
 */
export const FULL_DAY_STORIES: DayStory[] = [
  { id: 's1', title: 'ET-772 · Fire the context warning from three places', rows: 6 },
  { id: 's2', title: 'FUT-2210 · The journey ticket', rows: 3 },
];

export const FULL_DAY_LANES: DayLaneFixture[] = [
  {
    key: 'lane:break',
    label: 'Break',
    narrow: true,
    bands: [
      { id: 'br1', kind: 'break', ask: 'nothing', from: '12:15', minutes: 45, label: 'Break' },
      { id: 'br2', kind: 'break', ask: 'nothing', from: '15:30', minutes: 15, label: 'Break' },
    ],
  },
  {
    key: 'lane:ethlete-sdk',
    label: 'ethlete-sdk',
    bands: [
      {
        id: 'e1',
        kind: 'work',
        ask: 'nothing',
        from: '08:45',
        minutes: 45,
        label: 'ET-772',
        detail: 'feat(agent-rules): Fire the context warning',
      },
      {
        id: 'e1b',
        kind: 'work',
        ask: 'nothing',
        from: '09:30',
        minutes: 30,
        label: 'ET-772',
        detail: 'test(agent-rules): Cover the three call sites',
      },
      {
        id: 'e2',
        kind: 'work',
        ask: 'a glance',
        from: '10:00',
        minutes: 45,
        label: 'ET-772',
        detail: 'fix(repo): Cut the inlay instead of breaking it',
      },
      {
        id: 'e3',
        kind: 'work',
        ask: 'nothing',
        from: '10:45',
        minutes: 90,
        label: 'ET-772',
        detail: 'feat(repo): Pick Inlay as the band direction',
      },
      {
        id: 'e4',
        kind: 'work',
        ask: 'an answer',
        from: '13:00',
        minutes: 90,
        label: 'Not yet named',
        detail: 'chore(repo): Keep prettier off the exports',
      },
      {
        id: 'e5',
        kind: 'work',
        ask: 'a glance',
        from: '13:30',
        minutes: 60,
        label: 'ET-780',
        detail: 'fix(query): Drop the stale token',
      },
      { id: 'e6', kind: 'background', ask: 'nothing', from: '14:30', minutes: 60, label: 'in the background' },
    ],
  },
  {
    key: 'lane:fut-frontend',
    label: 'fut-frontend',
    bands: [
      {
        id: 'f1',
        kind: 'work',
        ask: 'a ticket',
        from: '09:15',
        minutes: 60,
        label: 'Toty public fixes',
        detail: 'fix(toty-public): Correct the showcase layout',
      },
      {
        id: 'f2',
        kind: 'work',
        ask: 'an answer',
        from: '15:45',
        minutes: 105,
        label: 'Not yet named',
        detail: 'feat(platform): Auto size the player item name',
      },
      { id: 'f3', kind: 'background', ask: 'nothing', from: '11:00', minutes: 45, label: 'in the background' },
    ],
  },
  {
    key: 'lane:calls',
    label: 'Calls & meetings',
    bands: [
      { id: 'c1', kind: 'work', ask: 'nothing', from: '09:00', minutes: 15, label: 'Daily' },
      {
        id: 'c2',
        kind: 'work',
        ask: 'a glance',
        from: '14:00',
        minutes: 60,
        label: 'Open Room #1',
        detail: 'Discord · four people',
      },
      { id: 'c3', kind: 'work', ask: 'nothing', from: '17:00', minutes: 45, label: 'Not counted', detail: 'Discord' },
    ],
  },
];
