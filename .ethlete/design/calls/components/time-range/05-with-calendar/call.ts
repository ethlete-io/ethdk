import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The time range picker',
  eyebrow: 'Components · call 5',
  headline: 'The ring next to the calendar',
  intro:
    'The date-time range input opens a range calendar and the ring in one panel, from 768px up. Every frame draws Fri 2 Oct 22:00 to Sun 4 Oct 06:30 with the "to" field focused. The ring shows only the time of day, so the centre carries the full duration and the end day. The single date-time input uses the same layout with one handle.',
  frameWidth: 680,
  rounds: [
    {
      key: 'r1',
      title: 'Where the ring goes',
      note: 'A won: the calendar and the ring are almost the same height, so the day and the time stay in view together. B is too tall for the space under a field, and C hides one pane.',
    },
    {
      key: 'r2',
      title: 'The centre of a range over many days',
      note: 'A total in hours grows without limit: 14 days is 320 h 30 min. Round 2 draws Fri 2 Oct 22:00 to Fri 16 Oct 06:30 in the layout of A. E won: the ring shows a time of day, so its centre shows the time and the day of the active end, and the calendar band shows the length. D kept a duration the ring cannot draw.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'chosen',
      round: 'r1',
      name: 'A · Side by side, as today',
      claim:
        'The calendar sits left, the ring right, both about 280px tall. A pick of the day and a drag of the time need no switch, and today’s layout stays.',
      cost: 'The panel is about 610px wide, so it needs the whole width of a small tablet.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · The ring under the calendar',
      claim: 'One column, 304px wide, the same width as the panel of the time input alone.',
      cost: 'The panel is about 590px tall, taller than the space under a field in most windows, so it flips or scrolls.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Dates and Times tabs, as the sheet does',
      claim:
        'The panel shows one pane at a time, like the bottom sheet, and each tab shows its value. Desktop and touch share one layout.',
      cost: 'The day and the time are never in view at once, and a pick needs a switch between the tabs.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      verdict: 'rejected',
      round: 'r2',
      name: 'D · Days, then hours',
      claim:
        'The centre counts whole days in large type and the rest in small type, so the number stays short for any range.',
      cost: 'For a range under one day the first line must change to hours, so the centre has two forms.',
      load: () => import('./variant-d'),
    },
    {
      key: 'e',
      verdict: 'chosen',
      round: 'r2',
      name: 'E · The time of the active end',
      claim:
        'The centre shows the time of the handle the focused field picks, and its day, like the single time ring. The calendar shows the length.',
      cost: 'The panel no longer shows the duration, and the reader counts the days in the calendar.',
      load: () => import('./variant-e'),
    },
  ],
});
