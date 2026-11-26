import { drawing, html } from '@design-explore';
import { GOAL, chart, frameStyles, linkName, linkValue, nodeKeys, trail } from './fixture';

export default drawing({
  body: html`
    ${chart({
      focus: GOAL,
      tabStops: nodeKeys,
      badges: [
        ...nodeKeys.slice(0, 6).map((mark, index) => ({ mark, label: `${index + 1}` })),
        { mark: GOAL, label: '7' },
      ],
      tooltip: `<strong>${linkName(GOAL)}</strong><span>${linkValue(GOAL)}</span><span class="muted">→ on to Staff · ← back · ↑↓ sibling link</span>`,
    })}
    ${trail(
      [
        { index: '1–6', keys: 'Tab', lands: 'node by node, to Reserve' },
        { index: '7', keys: '→', lands: `along its first outgoing link, ${linkName(GOAL)}` },
      ],
      '7 presses · 10 tab stops · → again lands on Staff',
    )}
  `,
  styles: frameStyles,
});
