import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · reference',
  headline: 'Six states, one gesture',
  intro:
    'No state touches the metal. The strip says what the band asks of the reader, and a pointer over a band says nothing about that, so the plate answers instead: hover lifts it and lights its top edge, focus lays a 2px ring on three sides so a packed lane cannot clip it and the strip stays readable, press takes the plate down into the ground, drag drops the band to 0.7 opacity so the grid reads through it, and marked closes two lit-brass brackets on the corners away from the metal — the one state that earns ornament, because it is chosen by hand and rare. Hover, focus and press are real pseudo-classes, so all six only stand open at once while Chromium’s CSS.forcePseudoState holds :hover, :focus-visible and :active over a CDP session; without that driver the middle three draw at rest.',
  frameWidth: 924,
  variants: [
    {
      key: 'states',
      name: 'The band under the pointer',
      load: () => import('./variant-states'),
    },
  ],
});
