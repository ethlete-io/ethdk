import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'State snapshots',
  stage: 'component',
  eyebrow: 'Components · ngStates() · view',
  headline: 'Two server-rendered states, swapped by a click',
  intro:
    'Edit shows the form field, Cancel and Save go back. Each state is a real ng() render; the swap runs in a View Transition.',
  frameWidth: 720,
  variants: [{ key: 'a', name: 'Edit a name', load: () => import('./variant-a') }],
});
