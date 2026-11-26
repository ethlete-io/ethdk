import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Server-side render',
  stage: 'component',
  eyebrow: 'Components · ng() · view',
  headline: 'The real button and form field, rendered on the design server',
  intro:
    'Buttons (filled, outline, tonal, disabled) and a form field with label, input and hint, rendered by ng() from the built @ethlete/components on a light and a dark surface.',
  frameWidth: 720,
  variants: [{ key: 'a', name: 'Button and field', load: () => import('./variant-a') }],
});
