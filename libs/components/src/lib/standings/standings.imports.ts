import { StandingsDirective, StandingsPickDirective, StandingsPickMarkDirective } from './headless';
import { StandingsPickComponent } from './standings-pick.component';
import { StandingsComponent } from './standings.component';

/**
 * The standings table (`<et-standings>`) and the headless directive to build a table of your own. Pulls in
 * the match domain's participant primitive for the name column.
 */
export const STANDINGS_IMPORTS = [StandingsComponent, StandingsDirective] as const;

/**
 * The predicted-order list (`<et-standings-pick>`), its headless directive, and the per-row mark template
 * a scored list fills.
 */
export const STANDINGS_PICK_IMPORTS = [
  StandingsPickComponent,
  StandingsPickDirective,
  StandingsPickMarkDirective,
] as const;
