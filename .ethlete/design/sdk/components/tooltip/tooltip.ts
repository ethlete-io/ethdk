import { tooltip, type TooltipMockOptions, tooltipStyles } from '@ethlete/components/design/tooltip';
import { definePart, drawing } from '@design-system';
import edge from './tooltip.css?inline';

const SHORT = 'Copy link';
const LONG = 'Everyone with the link can view this board. Comments stay private to the members of the workspace.';
const TEMPLATE = '<p><strong>Shift + C</strong></p><p>Copies the link to this board. Anyone with it can view.</p>';

export default definePart<TooltipMockOptions>({
  note: 'The SDK tooltip, drawn by its mock from @ethlete/components/design: the open pane with its arrow on the inherited surface. Short text, long text that wraps at the 34ch max width, template content, and each side the pane opens on, plus a -start and an -end placement with the arrow 20 px in. In the dark scheme the pane border and the arrow edge are a 1 px ring in --et-surface-ring-solid, 24 % --et-surface-color-solid over the fill, as in the foundations/elevation round. The token is defined here; the generator does not emit it yet.',
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
  describe: {
    short: 'The tooltip with Copy link; check the pane padding and the arrow.',
    long: 'A long tooltip text; check that it wraps at the 34ch max width.',
    template: 'Template content with a bold shortcut and a line; check the spacing between the two paragraphs.',
    top: 'The tooltip placed on top; check that the arrow points down, centered.',
    right: 'The tooltip placed on the right; check that the arrow points left, centered.',
    bottom: 'The tooltip placed below; check that the arrow points up, centered.',
    left: 'The tooltip placed on the left; check that the arrow points right, centered.',
    'bottom-start': 'The tooltip below at start; check that the arrow points up, 20px in from the start.',
    'top-end': 'The tooltip on top at end; check that the arrow points down, 20px in from the end.',
  },
  render: (options: TooltipMockOptions) =>
    drawing({
      body: `<div class="sdk-tooltip-stage">${tooltip(options)}</div>`,
      styles: [tooltipStyles, edge].join('\n'),
    }),
});
