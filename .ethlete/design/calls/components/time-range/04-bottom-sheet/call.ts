import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'The time range picker',
  eyebrow: 'Components · call 4',
  headline: 'The ring in the bottom sheet on touch',
  intro:
    'On a desktop the ring opens in the anchored panel of call 0, and the focused field picks the handle. On touch it opens in a bottom sheet under a scrim, so a tap on the other field closes the sheet. Every frame draws the range 22:00 to 06:30 on a 360px phone.',
  frameWidth: 360,
  rounds: [
    {
      key: 'r1',
      title: 'The ring on touch',
      note: 'C won. The larger ring gives each handle the 44px a finger needs, and a grab picks the handle, so the sheet needs no from and to toggle. A keeps handles too small for touch, and B brings back the toggle that call 0 rejected.',
    },
  ],
  variants: [
    {
      key: 'a',
      verdict: 'rejected',
      round: 'r1',
      name: 'A · The anchored panel, moved down',
      claim:
        'The sheet holds the desktop ring without a change: 280px, 24px handles. A drag on a handle moves that handle, so the sheet needs no control of its own.',
      cost: 'The handles are about half the 44px touch minimum, and the active handle can only change by a grab.',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      verdict: 'rejected',
      round: 'r1',
      name: 'B · The sheet repeats the two fields',
      claim:
        'Two large From and To buttons above the ring stand in for the fields under the scrim. A tap picks the active handle, as the focus does on a desktop.',
      cost: 'It brings back the from and to toggle that call 0 rejected, and the sheet is 80px taller.',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      verdict: 'chosen',
      round: 'r1',
      name: 'C · A larger ring, grab either handle',
      claim:
        'The ring fills the width of the sheet, 328px, and each handle is 44px. No handle is active: the one under the finger moves.',
      cost: 'The ring has a second size to keep in step, and the keyboard focus of the fields has no mark in the sheet.',
      load: () => import('./variant-c'),
    },
  ],
});
