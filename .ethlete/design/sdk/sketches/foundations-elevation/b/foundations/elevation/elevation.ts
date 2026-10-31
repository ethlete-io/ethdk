import { definePart } from '@design-system';
import { ELEVATION_STATES, elevationScene, type ElevationProps } from '@shared/elevation/scene';
import edge from './elevation.css?inline';

export default definePart<ElevationProps>({
  note: 'How the SDK lifts things off the base surface: a card, an elevated panel and an overlay pane (the select panel mock), side by side and as a pane over a panel. Fills come from the elevated surface tokens; no background colour differs from the product. In the dark scheme stronger shadows: --et-elevation-shadow-resting, --et-elevation-shadow-raised and --et-anchored-panel-shadow, each a 1 px black spread plus deeper blurs. The tokens are defined here; the generator does not emit them yet.',
  madeBy: ['claude-opus-5-5'],
  states: ELEVATION_STATES,
  render: (props: ElevationProps) =>
    elevationScene(
      props,
      { card: 'sdk-dark-shadow--card', panel: 'sdk-dark-shadow--panel', pane: 'sdk-dark-shadow--pane' },
      edge,
    ),
});
