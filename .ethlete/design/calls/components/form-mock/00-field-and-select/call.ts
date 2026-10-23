import { defineCall } from '@design-explore';

export default defineCall({
  legacy: true,
  feature: 'Component mocks',
  eyebrow: 'Components · design mocks · view',
  headline: 'The form field and select mocks on a light and a dark surface',
  intro:
    'formField(), input() and select() from @ethlete/components/design, drawn with the real form field and select CSS and the theme CSS of a fixture. A: hint, error, floating label with focus, disabled. B: a closed select, and an open one with its panel drawn below the field.',
  frameWidth: 720,
  variants: [
    { key: 'a', name: 'Form field mock', load: () => import('./variant-a') },
    { key: 'b', name: 'Select mock', load: () => import('./variant-b') },
  ],
});
