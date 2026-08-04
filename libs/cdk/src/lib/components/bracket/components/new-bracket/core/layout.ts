import { TOURNAMENT_MODE, TournamentMode } from './tournament';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const canRenderLayoutInTournamentMode = (layout: BracketDataLayout, mode: TournamentMode): boolean => {
  switch (mode) {
    case TOURNAMENT_MODE.SINGLE_ELIMINATION:
      return layout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT || layout === BRACKET_DATA_LAYOUT.MIRRORED;
    default:
      return layout === BRACKET_DATA_LAYOUT.LEFT_TO_RIGHT;
  }
};

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const BRACKET_DATA_LAYOUT = {
  LEFT_TO_RIGHT: 'left-to-right',

  // Currently only supported in single elimination brackets. Will throw an error if used in other bracket types
  MIRRORED: 'mirrored',
} as const;

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type BracketDataLayout = (typeof BRACKET_DATA_LAYOUT)[keyof typeof BRACKET_DATA_LAYOUT];
