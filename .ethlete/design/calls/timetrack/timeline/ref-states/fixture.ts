export type BandTone = 'success' | 'brand' | 'warning' | 'pending' | 'neutral';

export type BandCase = {
  name: string;
  asks: string;
  tone: BandTone;
  label: string;
  detail?: string;
  marked?: boolean;
  standIn?: boolean;
  excluded?: boolean;
  dragging?: boolean;
};

export const MINUTES = 45;

export const CASES: BandCase[] = [
  {
    name: 'certain',
    asks: 'nothing',
    tone: 'success',
    label: 'ET-772 · 45m',
    detail: 'feat(repo): Answer the parent with the epic',
  },
  {
    name: 'likely',
    asks: 'a glance',
    tone: 'brand',
    label: 'ET-772 · 45m',
    detail: 'fix(agent-rules): Fire the warning',
  },
  {
    name: 'weak',
    asks: 'a yes or a no',
    tone: 'warning',
    label: 'Not yet named · 45m',
    detail: 'feat(platform): Auto size the player item name',
  },
  {
    name: 'stand-in',
    asks: 'a ticket, later',
    tone: 'pending',
    label: 'Toty public fixes · 45m',
    detail: 'fix(toty-public): Correct the showcase layout',
    standIn: true,
  },
  { name: 'excluded', asks: 'nothing', tone: 'neutral', label: 'Not counted · 45m', detail: 'Open Room #1 · Discord' },
  {
    name: 'marked',
    asks: 'a merge',
    tone: 'success',
    label: 'ET-772 · 45m',
    detail: 'Marked for a merge',
    marked: true,
  },
  {
    name: 'dragging',
    asks: 'a drop',
    tone: 'brand',
    label: 'ET-772 · 45m',
    detail: 'Moves under the pointer',
    dragging: true,
  },
];
