import { StandingsDirective } from './headless';
import { StandingsComponent } from './standings.component';

/**
 * The standings table (`<et-standings>`) and the headless directive to build a table of your own. Pulls in
 * the match domain's participant primitive for the name column.
 */
export const STANDINGS_IMPORTS = [StandingsComponent, StandingsDirective] as const;
