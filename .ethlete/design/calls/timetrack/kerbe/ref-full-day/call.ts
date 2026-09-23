import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Kerbe · reference',
  headline: 'Inlay across a whole day',
  intro:
    "The app's own geometry at the real window size, 1100x760: the four lanes, the narrow break lane, the all-day strip, two bands that overlap inside one lane, and background stretches. A band judged on its own in a short lane says nothing about how a day reads, so this is the picture every later call is checked against - whatever a call settles has to hold here too.",
  frameWidth: 1100,
  variants: [
    {
      key: 'day',
      name: 'Tuesday, 16 September',
      load: () => import('./variant-day'),
    },
  ],
});
