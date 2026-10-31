import { streamPlayerSlot, StreamMockState, streamStyles } from '@ethlete/components/design/stream';
import { definePart, drawing } from '@design-system';
import frame from './stream.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = { state: StreamMockState; button?: Interaction };

const VIDEO = '<div class="t-video" aria-hidden="true"></div>';

const buttonAttributes = (interaction: Interaction | undefined) =>
  ['data-et-control="action" data-can-animate', interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

export default definePart({
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5'],
  states: {
    player: { state: 'player' },
    consent: { state: 'consent' },
    loading: { state: 'loading' },
    error: { state: 'error' },
    'pip-placeholder': { state: 'pip-placeholder' },
    'consent-hover': { state: 'consent', button: 'hover' },
    'consent-active': { state: 'consent', button: 'active' },
    'consent-focus-visible': { state: 'consent', button: 'focus-visible' },
  },
  widths: [320, 480, 720],
  controls: {
    action: { kind: 'button', input: ['pointer', 'keyboard'] },
  },
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: streamPlayerSlot({
        state: props.state,
        player: VIDEO,
        buttonAttributes: buttonAttributes(props.button),
      }).replace('<et-spinner ', '<et-spinner data-et-skip="CLIPPED" '),
      styles: [streamStyles, frame].join('\n'),
    }),
});
