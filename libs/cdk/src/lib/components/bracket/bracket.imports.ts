import { BracketComponent } from './components/bracket';
import { BracketMatchComponent } from './partials/bracket-match';
import { BracketRoundHeaderComponent } from './partials/bracket-round-header';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const BracketImports = [BracketComponent, BracketMatchComponent, BracketRoundHeaderComponent] as const;
