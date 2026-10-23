import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'Component mocks',
  eyebrow: 'Components · design mocks · view',
  headline: 'The button mock on a light and a dark surface',
  intro:
    'The button() mock from @ethlete/components/design/button, drawn with the real button CSS and the theme CSS of a fixture surface and color theme. Filled, outline, tonal, transparent, pressed and disabled.',
  frameWidth: 720,
  variants: [{ key: 'a', name: 'Button mock', load: () => import('./variant-a') }],
});
