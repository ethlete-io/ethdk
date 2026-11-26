import { css, drawing } from '@design-explore';
import { BLUE, PALETTE, TEAL, frameStyles, states } from './fixture';

const code = `series = computed(() =>
  [
    { key: '2024', name: '2024', data: q2024 },
    { key: '2025', name: '2025', data: q2025 },
    { key: '2026', name: '2026', data: q2026 },
  ].filter((entry) => this.visible().has(entry.key)),
);`;

export default drawing({
  body: states(PALETTE, [BLUE, TEAL], code),
  styles: css`
    ${frameStyles}
  `,
});
