import { definePart } from '@design-system';
import { ELEVATION_STATES, elevationScene, type ElevationProps } from '@shared/elevation/scene';
import edge from './elevation.css?inline';

export default definePart<ElevationProps>({
  note: 'How the SDK lifts things off the base surface: a card, an elevated panel and an overlay pane (the select panel mock), side by side and as a pane over a panel. Fills come from the elevated surface tokens; no background colour differs from the product. In the dark scheme a 1 px ring in --et-surface-ring-solid (24 % --et-surface-color-solid over the fill) replaces the border colour. The token is defined here; the generator does not emit it yet.',
  madeBy: ['claude-opus-5-5'],
  states: ELEVATION_STATES,
  render: (props: ElevationProps) =>
    elevationScene(props, { card: 'sdk-ring', panel: 'sdk-ring', pane: 'sdk-ring' }, edge),
});
