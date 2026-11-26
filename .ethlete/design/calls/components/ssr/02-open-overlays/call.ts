import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Server-side render',
  stage: 'component',
  eyebrow: 'Components · ng() · view',
  headline: 'An open select and an open menu, rendered on the design server',
  intro:
    'The real select panel and menu of @ethlete/components, rendered open by ng() and placed under their triggers by the frame.',
  frameWidth: 720,
  variants: [{ key: 'a', name: 'Open overlays', load: () => import('./variant-a') }],
});
