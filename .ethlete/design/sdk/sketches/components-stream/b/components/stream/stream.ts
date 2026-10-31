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
  note: "The SDK stream player slot (etStreamPlayerSlot) and the overlays it mounts in flow, first drawing, drawn by the mock from @ethlete/components/design/stream with the real markup and CSS: the player slot, the shared overlay card, et-stream-consent, et-stream-player-loading (et-spinner, 35px, stroke 2, with track, the sweep held at one frame), et-stream-player-error and et-pip-slot-placeholder, plus the button and icon sheets; default labels and button colors (null, so the buttons take the color theme around them, brand mint here). No real third-party player or iframe: the player element is a neutral fake video box (14 % surface ink on the surface, a muted play glyph). The slot is framed as a page with 16px padding, full width, 16:9 (the consumer sets the size; the slot itself only clips to a 12px radius). Widths 320 (288 x 162 slot: under the 200px container height the overlay card hides its icon), 480 (448 x 252) and 720 (688 x 387). States: player (the bare player), consent (the lock, Content blocked, the description, filled Allow and play; no player behind it, the slot holds it back until consent), loading (the spinner on the surface, over the player), error (the triangle, Playback failed, the description, filled Retry), pip-placeholder (the arrow-out icon, Playing in picture-in-picture, filled Back to player: the box left behind when the player floats), consent-hover, consent-active and consent-focus-visible (the accept button forced). Numbers (light / dark), from shot pixels at scale 2 at 480, brand mint, a: heading (consent, error) vs the overlay 17.93 / 17.18; description and PiP message (muted) 7.81 / 6.94; card icon (subtle) 4.95 / 4.99; the overlay fill is the page surface (1.00 / 1.00); spinner arc (primary) vs overlay 1.33 / 13.50, vs its 24 % track 1.19 / 7.29; filled button vs overlay 1.33 / 13.50, its label 15.82 / 15.82; button focus ring (the focused fill colour) vs overlay 1.37 / 13.06; hover fill vs rest 1.03 / 1.03; fake video vs page 1.33 / 1.51 (light / dark, fixture only). Q98 numbers only: the slot has no edge, and every overlay paints the page surface, so in consent, loading, error and PiP the slot's box and 12px radius vanish into the page (1.00 / 1.00). Decided rules that arise: Q88 (the button focus ring), Q99a (the spinner arc, a primary-coloured mark; the filled button is a mint fill, so it takes a 1px inset ink edge) and Q101 (filled button hover = -active). The ink edge on the mint fill arises, so Q102 arises: b draws the edge in both schemes, c keeps dark as today (edge light-dark(ink, transparent)). Findings for later: (1) every overlay paints --et-surface-background-solid, the same as the page, so the player area loses its shape behind consent, loading, error and PiP; a later round could give the overlays a raised or tinted surface or an edge (open call, not drawn). (2) At the slot's rounded corners the fake video shows a faint anti-aliased halo through the loading overlay (both clipped by the same 12px radius); with a real dark video it would read as a thin grey corner ghost. (3) et-button sets no font-family, so the labels render in the UA button font, not the page font (all three overlay buttons). (4) The overlay card (container-type: size) raises a ResizeObserver loop warning in the render check; harmless here. (5) The spinner's arc halves clip on purpose: marked data-et-skip CLIPPED on the et-spinner in every variant, not a bug. Later rounds, left out here: the floating PiP window and its chrome (pip-chrome, the PiP overlay card, the dark PiP surface, the bring-back pulse), the consent provider flow, custom labels and button colors, a custom spinner size, a real player and iframe, RTL, long labels, the error and PiP buttons forced into hover and focus (they are the same et-button as consent).",
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
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${streamPlayerSlot({ state: props.state, player: VIDEO, buttonAttributes: buttonAttributes(props.button) }).replace('<et-spinner ', '<et-spinner data-et-skip="CLIPPED" ')}</div>`,
      styles: [streamStyles, frame].join('\n'),
    }),
});
