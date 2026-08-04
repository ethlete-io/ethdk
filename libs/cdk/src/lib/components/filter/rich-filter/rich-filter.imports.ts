import { RichFilterHostComponent } from './components/rich-filter-host';
import { RichFilterButtonDirective } from './directives/rich-filter-button';
import { RichFilterButtonSlotDirective } from './directives/rich-filter-button-slot';
import { RichFilterContentDirective } from './directives/rich-filter-content';
import { RichFilterTopDirective } from './directives/rich-filter-top';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const RichFilterImports = [
  RichFilterHostComponent,
  RichFilterButtonDirective,
  RichFilterButtonSlotDirective,
  RichFilterContentDirective,
  RichFilterTopDirective,
] as const;
