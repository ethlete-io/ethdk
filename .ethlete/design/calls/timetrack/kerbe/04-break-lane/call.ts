import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 4',
  headline: 'Where a break goes',
  intro:
    'The app gives a break its own 6rem column, and every band in it repeats the column header. A break is also not work in a checkout - it is the absence of work in all of them at once, so a lane beside the work lanes says the wrong thing. Each frame is the whole day at 1100x760, the same day as the reference view, with the two breaks at 12:15 and 15:30.',
  frameWidth: 1100,
  options: [
    {
      key: 'a',
      name: 'A · The column stays, the word goes',
      claim:
        'The lane keeps its 6rem. Each band drops "Break" and shows its length, because the header already names it.',
      cost: 'A break still reads as a track running beside the work, and 6rem is spent all day on two events.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      name: 'B · A rule across the day',
      claim:
        'No column. A break is a stretch across every lane, named once in the gutter. The work lanes take the 6rem back.',
      cost: 'It cuts the day in two places, and a band that did overlap a break would have nowhere to sit.',
      verdict: 'chosen',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      name: 'C · A mark in the hour gutter',
      claim: 'The break leaves the field and marks the time axis instead, where the day already keeps its clock.',
      cost: 'A strip with no word has to be learned once, and a 15m break is only 2rem of it.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
    {
      key: 'd',
      name: 'D · The day closes up',
      claim:
        'A break costs no height at all. The rows meet at a dashed seam and the day gets an hour of its screen back.',
      cost: 'The hour axis stops being linear, so a band’s height and its place no longer read off the same scale.',
      verdict: 'rejected',
      load: () => import('./option-d'),
    },
  ],
});
