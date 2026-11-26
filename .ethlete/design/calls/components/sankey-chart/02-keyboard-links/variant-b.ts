import { drawing, html } from '@design-explore';
import { GOAL, chart, frameStyles, linkKey, linkName, linkValue, trail } from './fixture';

export default drawing({
  body: html`
    ${chart({
      focus: GOAL,
      chartStop: true,
      badges: [
        { mark: 'tickets', label: '1' },
        { mark: 'budget', label: '2' },
        { mark: 'reserve', label: '3' },
        { mark: GOAL, label: '4' },
      ],
      tooltip: `<strong>${linkName(GOAL)}</strong><span>${linkValue(GOAL)}</span><span class="muted">1 of 2 · ↑↓ next link · Esc back to Reserve</span>`,
    })}
    ${trail(
      [
        { keys: 'Tab', lands: 'the chart, on Tickets' },
        { keys: '→', lands: 'next column, Budget' },
        { keys: '↓', lands: 'Reserve' },
        { keys: 'Enter', lands: `its first outgoing link, ${linkName(linkKey('reserve', 'staff'))}` },
      ],
      '4 presses · 1 tab stop for the whole chart',
    )}
  `,
  styles: frameStyles,
});
