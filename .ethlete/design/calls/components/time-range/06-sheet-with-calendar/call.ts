import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The time range picker',
  eyebrow: 'Components · call 6',
  headline: 'The calendar and the ring in the bottom sheet',
  intro:
    'Below 768px the date-time range input opens a bottom sheet. Today it has Dates and Times tabs, and a pick of both days moves it to Times once. Every frame draws Fri 2 Oct 22:00 to Sun 4 Oct 06:30 on a 360px phone, with the touch ring of call 4 and the centre of call 5.',
  frameWidth: 360,
  rounds: [
    {
      key: 'r1',
      title: 'Two panes on a phone',
      note: 'A won: the tabs stay, as other sheets in the library already use them, and the Times tab holds the touch ring. B stacks both parts past the height of a phone, and C adds a step flow no other sheet has.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'chosen',
      round: 'r1',
      name: 'A · Tabs, as today',
      claim:
        'The Dates and Times tabs stay, and each tab shows its value. The Times tab holds the 328px ring, so the sheet keeps one height.',
      cost: 'The day and the time are never in view at once, as in C of call 5.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · One sheet that scrolls',
      claim: 'The calendar and the ring are stacked in a tall sheet, as on a desktop but in one column.',
      cost: 'The two parts are about 670px tall. This frame is 740px, but with the browser bar most phones show less, so the sheet scrolls and a drag on the ring can fight the scroll.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'rejected',
      round: 'r1',
      name: 'C · Two steps, days then times',
      claim:
        'The sheet opens on the calendar. A pick of both days replaces it with the ring, and a back row shows the days.',
      cost: 'The way back to the days is a small row, and the sheet has no plain view of both panes to switch between.',
      load: () => import('./variant-c'),
    },
  ],
});
