import { drawing, html } from '@design-explore';
import { GOAL, chart, frameStyles, linkKeys, linkName, linkValue, nodeKeys, trail } from './fixture';

const goalIndex = linkKeys.indexOf(GOAL);
const visitedLinks = linkKeys.slice(0, goalIndex + 1);

export default drawing({
  body: html`
    ${chart({
      focus: GOAL,
      tabStops: [...nodeKeys, ...linkKeys],
      badges: [...nodeKeys, ...visitedLinks].map((mark, index) => ({ mark, label: `${index + 1}` })),
      tooltip: `<strong>${linkName(GOAL)}</strong><span>${linkValue(GOAL)}</span>`,
    })}
    ${trail(
      [
        { index: '1–10', keys: 'Tab', lands: 'every node, Tickets to Marketing' },
        { index: `11–${10 + visitedLinks.length}`, keys: 'Tab', lands: `every link, up to ${linkName(GOAL)}` },
      ],
      `${10 + visitedLinks.length} presses · 22 tab stops before Tab leaves the chart`,
    )}
  `,
  styles: frameStyles,
});
