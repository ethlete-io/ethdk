import { css, drawing } from '@design-explore';
import { BLUE, PALETTE, PURPLE, frameStyles, states } from './fixture';

const code = `providers: [
  provideColorPalette({
    byKey: { '2024': 'blue', '2025': 'teal', '2026': 'purple' },
  }),
],

series = computed(() =>
  [
    { key: '2024', name: '2024', data: q2024 },
    { key: '2025', name: '2025', data: q2025 },
    { key: '2026', name: '2026', data: q2026 },
  ].filter((entry) => this.visible().has(entry.key)),
);

// an unmapped key falls back to its position in series`;

export default drawing({
  body: states(PALETTE, [BLUE, PURPLE], code),
  styles: css`
    ${frameStyles}
  `,
});
