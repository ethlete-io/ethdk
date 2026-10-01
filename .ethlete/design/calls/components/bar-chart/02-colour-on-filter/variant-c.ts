import { css, drawing } from '@design-explore';
import { BLUE, PALETTE, PURPLE, frameStyles, states } from './fixture';

const code = `series = computed(() =>
  [
    { key: '2024', name: '2024', data: q2024, colorToken: 'blue' },
    { key: '2025', name: '2025', data: q2025, colorToken: 'teal' },
    { key: '2026', name: '2026', data: q2026, colorToken: 'purple' },
  ].filter((entry) => this.visible().has(entry.key)),
);

// docs: a series the app can filter sets its own colorToken`;

export default drawing({
  body: states(PALETTE, [BLUE, PURPLE], code),
  styles: css`
    ${frameStyles}
  `,
});
