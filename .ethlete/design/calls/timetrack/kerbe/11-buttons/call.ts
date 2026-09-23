import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · call 11',
  headline: 'How much of the reference a working button keeps',
  intro:
    'Call 10 stopped because every button in it was a placeholder. The brand reference draws a full button system: square corners throughout, a plate, a 1px hairline frame, and one signature figure - a 1px L with 9px arms inset 4px from each corner, doubled by a 4px L offset 3px further in at 65%, each long arm ending in a 1x1 pip. It also draws a light that runs the perimeter and never stops. That set was drawn at display size to be looked at. A scheduler toolbar has five controls in one row, sits above a field every call since 5 has kept quiet, and is looked past. Each frame draws the same day and the same five controls - previous, next, Today, Add an entry, Debug - and changes only how much of the reference they wear. The type is the reference type in all four: Jost 500, uppercase, 10.5px, 0.2em tracking, opening to 0.24em on hover.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'How much of the reference a toolbar keeps',
      note: '',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · The plate alone',
      claim:
        'The reference‘s own secondary rank, which carries no bracket and no wash: a plate, a 1px hairline frame, square corners. Rank is the frame‘s alpha and nothing else. It is the only one of the four the reference itself judged safe to repeat on a screen.',
      cost: 'Nothing in the row says which control the reader came for, and the set is a hairline away from the placeholder buttons call 10 already drew. The brand shows up as a typeface and a square corner.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · The plate and the corner bracket',
      claim:
        'A, and Add an entry takes the doubled corner bracket at the geometry it was drawn at. The one figure that makes this set art deco marks the one control that does something, and every other button stays a plate.',
      cost: 'Twenty-four hairlines on one button. The arrows are 30px tall, where the inner L and its pip merge into the outer one, so they cannot carry the figure even if they wanted it.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · The bracket and the patina',
      claim:
        'B, and Add an entry takes the reference‘s accent with it: the frame and an upward wash in the patina teal the reference gives its primary rank. The control that writes to the day is the only coloured thing in the frame.',
      cost: 'It puts a colour in the palette that Kerbe does not have, and the toolbar becomes the only teal on screen, above a field drawn in ink and one metal.',
      load: () => import('./variant-c'),
    },
    {
      key: 'd',
      round: 'r1',
      name: 'D · The reference‘s primary, whole',
      claim:
        'C, and the travelling light: one head runs the button‘s perimeter at half pace and lights each bracket as it passes. It is the reference drawn as the reference drew it, with nothing taken out.',
      cost: 'Something moves forever, in the one frame every call since 5 worked to keep still. A toolbar sits at the top of a day the reader scans past, not at something they are asked to watch.',
      load: () => import('./variant-d'),
    },
  ],
});
