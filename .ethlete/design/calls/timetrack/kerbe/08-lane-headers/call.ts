import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 8',
  headline: 'What a lane header carries',
  intro:
    'A lane is one checkout, and its header names it and nothing else. The day total sits in the title bar, so nothing on screen says where the day went. Every frame draws the same day, with the axis as call 7 settled it, and the all-day story strip left out, which the user cut on 2026-09-17. Only the header changes. How the header is set - mono, uppercase, tracked - stays what the app has today in all four.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'What the header carries',
      note: 'B won: the lane total is the one fact the column below cannot show, and it is text in the frame, so it claims nothing about any minute. C spends brass on size, and brass means a band asks. D repeats in words what the metal already says in the column.',
    },
    {
      key: 'r2',
      title: 'B, and which of the two leads',
      note: 'All three rejected. Every one of them changes the size or the number of rows, and the user ruled that the hierarchy has to come from the ink alone: "i think we should do this only using font color." The uppercase fix they carry is kept, because a clock is not a tag.',
    },
    {
      key: 'r3',
      title: 'The same row, and only the ink changes',
      note: 'I won. The name takes --k-ink and the total drops to --k-ink-3, so the column says what it is first and the number waits to be looked for. H put the bright ink on the number and made four totals the loudest row on screen, above a field the exploration keeps quiet. J lifted the total one step to --k-ink-2, which did not separate them at 1.05rem mono. All three drop the uppercase from the clock, which is a defect fix and not a variable.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · The name alone',
      claim: 'What the app draws today. The checkout name, in tracked mono, and nothing beside it.',
      cost: 'Nothing says where the day went. The reader adds up the bands in a column by eye, or reads the day total and cannot break it down.',
      verdict: 'rejected',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · The name and the lane total',
      claim:
        'The header carries the time booked in that lane, at the right of the same row. It is the one fact the column below cannot show, and it is text in the frame, so it makes no claim about any minute.',
      cost: 'Four totals now compete with the day total in the title bar, and a narrow lane has to drop one of the two.',
      verdict: 'chosen',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · The total, and a bar for the share',
      claim:
        'B, and a 2px brass bar along the bottom edge of the header, as wide as that lane‘s share of the day. The columns compare without reading four numbers.',
      cost: 'A second gesture in brass, in a place that is not the band. Brass says a band asks something, and here it would say size instead.',
      verdict: 'rejected',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      round: 'r1',
      name: 'D · The count of what still asks',
      claim:
        'The header says how many bands in that lane still ask the reader for something, in brass. It points at the work instead of totalling it, which is the rule the band treatment already carries.',
      cost: 'The column below already shows this in metal, so the header repeats what the reader can see. It also says nothing at all once a lane is answered.',
      verdict: 'rejected',
      load: () => import('./variant-d'),
    },
    {
      key: 'e',
      round: 'r2',
      name: 'E · The total leads',
      claim:
        'The total goes to 1.5rem in the brightest ink and drops the uppercase, and the name beside it drops to 0.95rem. The header reads as a number with a caption, so four lanes compare at a glance.',
      cost: 'The name is what the reader clicks and drags into; making it the smaller of the two puts the weight on a fact they read once.',
      verdict: 'rejected',
      load: () => import('./variant-e'),
    },
    {
      key: 'f',
      round: 'r2',
      name: 'F · The name leads',
      claim:
        'The name goes to 1.2rem in the brightest ink and the total stays small and dim beside it. The column keeps its identity first, and the number supports it.',
      cost: 'Four bright names across the top are the loudest row on screen, and the reader already knows which checkout is which.',
      verdict: 'rejected',
      load: () => import('./variant-f'),
    },
    {
      key: 'g',
      round: 'r2',
      name: 'G · The total sits under the name',
      claim:
        'Two rows, both left-aligned: the name on top in the brightest ink, the total under it, small and dim. Neither competes for the same row, so a narrow lane never has to drop one.',
      cost: 'The header is twice as tall, and that height is taken from the day on every screen.',
      verdict: 'rejected',
      load: () => import('./variant-g'),
    },
    {
      key: 'h',
      round: 'r3',
      name: 'H · The total takes the bright ink',
      claim:
        'The name stays at --k-ink-3, where it is today, and the total goes to --k-ink. The number is the new fact, so it is the one that lifts.',
      cost: 'Four bright numbers read as the loudest row on screen, above a field the exploration has kept quiet throughout.',
      verdict: 'rejected',
      load: () => import('./variant-h'),
    },
    {
      key: 'i',
      round: 'r3',
      name: 'I · The name takes the bright ink',
      claim:
        'The name goes to --k-ink and the total drops to --k-ink-3. The column says what it is first, and the number is there when the reader looks for it.',
      cost: 'The total is then dimmer than it is today, so the fact the round was opened for is the quietest thing in the header.',
      verdict: 'chosen',
      load: () => import('./variant-i'),
    },
    {
      key: 'j',
      round: 'r3',
      name: 'J · The total lifts one step',
      claim:
        'The name stays at --k-ink-3 and the total goes to --k-ink-2, one step and no further. The two separate without either becoming loud.',
      cost: 'One step of ink is a small difference at 1.05rem mono, and it may not read at all at arm‘s length.',
      verdict: 'rejected',
      load: () => import('./variant-j'),
    },
  ],
});
