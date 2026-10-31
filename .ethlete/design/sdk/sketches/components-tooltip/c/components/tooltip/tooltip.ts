import { tooltip, type TooltipMockOptions, tooltipStyles } from '@ethlete/components/design/tooltip';
import { definePart, drawing } from '@design-system';
import edge from './tooltip.css?inline';

const SHORT = 'Copy link';
const LONG = 'Everyone with the link can view this board. Comments stay private to the members of the workspace.';
const TEMPLATE = '<p><strong>Shift + C</strong></p><p>Copies the link to this board. Anyone with it can view.</p>';

export default definePart<TooltipMockOptions>({
  note: 'The SDK tooltip, drawn by its mock from @ethlete/components/design: the open pane with its arrow on the inherited surface. Short text, long text that wraps at the 34ch max width, template content, and each side the pane opens on, plus a -start and an -end placement with the arrow 20 px in. In the dark scheme the pane border and the arrow edge are a 1 px ring in --et-surface-ring-solid, 35 % --et-surface-color-solid over the fill, for 3:1 against the base. The token is defined here; the generator does not emit it yet.',
  madeBy: ['claude-opus-5-5'],
  states: {
    short: { text: SHORT },
    long: { text: LONG },
    template: { content: TEMPLATE },
    top: { text: SHORT, placement: 'top' },
    right: { text: SHORT, placement: 'right' },
    bottom: { text: SHORT, placement: 'bottom' },
    left: { text: SHORT, placement: 'left' },
    'bottom-start': { text: 'Copy the link to this board', placement: 'bottom-start' },
    'top-end': { text: 'Copy the link to this board', placement: 'top-end' },
  },
  render: (options: TooltipMockOptions) =>
    drawing({
      body: `<div class="sdk-tooltip-stage">${tooltip(options)}</div>`,
      styles: [tooltipStyles, edge].join('\n'),
    }),
});
