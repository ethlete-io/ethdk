import { streamPlayerSlot, StreamMockState, streamStyles } from '@ethlete/components/design/stream';
import { definePart, drawing } from '@design-system';
import frame from './stream.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = { state: StreamMockState; button?: Interaction };

const VIDEO = '<div class="t-video" aria-hidden="true"></div>';

const ACTIONS: Partial<Record<StreamMockState, string>> = {
  consent: 'loading',
  error: 'loading',
  'pip-placeholder': 'player',
};

const buttonAttributes = (state: StreamMockState, interaction: Interaction | undefined) =>
  [
    `data-et-control="action" data-et-action="${ACTIONS[state]}" data-can-animate`,
    interaction && `data-et-force="${interaction}"`,
  ]
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
  describe: {
    player: 'The stream slot holding the player; check that the video fills the slot at its ratio.',
    consent: 'The consent screen before the player loads; check the message and the action button, centered.',
    loading: 'The stream slot loading; check that the spinner sits centered in the slot.',
    error: 'The stream slot after an error; check the error message, centered in the slot.',
    'pip-placeholder':
      'The placeholder while the stream plays picture-in-picture; check its message in the empty slot.',
    'consent-hover': 'The consent action hovered; check that only the button shows the hover look.',
    'consent-active': 'The consent action pressed; check that the press look is deeper than hover.',
    'consent-focus-visible': 'The consent action focused by keyboard; check that the focus ring wraps the button.',
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
        buttonAttributes: buttonAttributes(props.state, props.button),
      }),
      styles: [streamStyles, frame].join('\n'),
    }),
});
