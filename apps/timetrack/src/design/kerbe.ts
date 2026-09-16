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
