import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The time range picker',
  eyebrow: 'Components · call 1',
  headline: 'What the overlay shows for a single time',
  intro:
    'Call 0 gave the range a 24h ring. This call asks what a single time gets. Every frame draws 14:30 with a minute step of 15, and the input already shows the value, so no frame repeats it.',
  frameWidth: 360,
  rounds: [
    {
      key: 'r1',
      title: 'Ring, columns or dial',
      note: 'C won: the ring snaps to whole hours, so a drag is easy to land, and it matches the range ring. The minute chips felt odd, so r2 asks only how the minute is picked.',
    },
    {
      key: 'r2',
      title: 'How C picks the minute',
      note: 'All three lost. None of them felt right, and no main system adds a separate minute control to a ring: iOS Bedtime drags hour and minute at once with a coarse snap, Android changes the dial to minutes in a second step.',
    },
    {
      key: 'r3',
      title: 'What the systems do',
      note: 'H won: one drag sets hour and minute, snapped to the minute step, with the time live in the centre like iOS Bedtime. It is B of r1 plus the readout. An exact minute is typed in the input. I lost: a slot list does not look like the range ring.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      verdict: 'rejected',
      name: 'A · The columns of today',
      claim: 'Hours and minutes as two lists, with no range tint. A mouse user clicks two options and is done.',
      cost: 'The single time and the range look like two different components, and the lists add nothing the input cannot show.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      verdict: 'rejected',
      name: 'B · The ring with one handle',
      claim:
        'The ring of call 0 with one handle and a hand. One drag sets hour and minute together, and it matches the range picker.',
      cost: 'A full day on one ring is 96 steps of 15 minutes, so a drag lands on the right minute only with care.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      verdict: 'chosen',
      name: 'C · The ring for the hour, chips for the minute',
      claim:
        'The ring snaps to whole hours only, so a drag is easy to land. A row of chips under it sets the minute in one tap.',
      cost: 'The panel grows by one row, and a small minute step such as 5 needs twelve chips.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      round: 'r1',
      verdict: 'rejected',
      name: 'D · The M3 dial',
      claim:
        'The Material 3 dial: 1 to 12 outside, 00 and 13 to 23 inside. The hour and minute fields in the input pick the mode, so the dial then shows the minutes.',
      cost: 'Two steps for each value, and its face does not look like the range ring.',
      load: () => import('./variant-d'),
    },
    {
      key: 'e',
      round: 'r2',
      verdict: 'rejected',
      name: 'E · A minute dial inside the ring',
      claim:
        'A small second ring in the centre holds the minute steps. The hour and the minute sit on one face, one drag and one tap, with no extra row.',
      cost: 'The inner ring is small, so a step of 5 puts twelve targets on a circle of about 90px.',
      load: () => import('./variant-e'),
    },
    {
      key: 'f',
      round: 'r2',
      verdict: 'rejected',
      name: 'F · The ring turns into minutes',
      claim:
        'When the hour drag ends, the same ring shows 00 to 55 and the minute field in the input takes the focus. Every step gets the full size of the ring.',
      cost: 'Two steps for every value, and the hour is out of sight while the minute is picked.',
      load: () => import('./variant-f'),
    },
    {
      key: 'g',
      round: 'r2',
      verdict: 'rejected',
      name: 'G · A minute stepper in the centre',
      claim:
        'The centre shows :30 with a chevron above and below. A tap or the mouse wheel moves one minute step, and the ring stays for the hour.',
      cost: 'From :00 to :45 takes three taps, and a step of 5 takes up to eleven.',
      load: () => import('./variant-g'),
    },
    {
      key: 'h',
      round: 'r3',
      verdict: 'chosen',
      name: 'H · One drag with a live readout, like iOS Bedtime',
      claim:
        'B again, drawn while the handle is dragged. One drag sets the hour and the minute, snapped to the minute step, and the centre shows the time live, so a finger that covers the input still sees the value.',
      cost: 'A step of 15 puts 96 stops on the ring, about 7px each, so a slow hand is needed; a step of 1 can only be typed.',
      load: () => import('./variant-h'),
    },
    {
      key: 'i',
      round: 'r3',
      verdict: 'rejected',
      name: 'I · A list of slots, like Google Calendar',
      claim:
        'One list of times at the minute step, opened on the value. One tap picks it, and in a range the end list could show the duration beside each slot.',
      cost: 'It leaves the ring of call 0, so the single time and the range look different, and a step of 5 makes a long list.',
      load: () => import('./variant-i'),
    },
  ],
});
