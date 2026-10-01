import { drawing, html } from '@design-explore';
import { chart, frameStyles, nodeKeys, trail } from './fixture';

export default drawing({
  body: html`
    ${chart({
      focus: 'reserve',
      tabStops: nodeKeys,
      badges: nodeKeys.slice(0, 6).map((mark, index) => ({ mark, label: `${index + 1}` })),
      tooltip:
        '<strong>Reserve</strong><span>In 350 · Out 350</span><span class="muted">→ Staff 200</span><span class="muted">→ Marketing 150</span>',
    })}
    ${trail(
      [
        { index: '1–6', keys: 'Tab', lands: 'node by node, to Reserve' },
        { index: '6', keys: '', lands: 'the tooltip lists Reserve → Staff 200' },
      ],
      '6 presses · 10 tab stops · links never take focus',
    )}
  `,
  styles: frameStyles,
});
