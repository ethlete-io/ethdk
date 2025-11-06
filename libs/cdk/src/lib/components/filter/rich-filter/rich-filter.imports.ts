import { RichFilterHostComponent } from './components/rich-filter-host';
import { RichFilterButtonDirective } from './directives/rich-filter-button';
import { RichFilterButtonSlotDirective } from './directives/rich-filter-button-slot';
import { RichFilterContentDirective } from './directives/rich-filter-content';
import { RichFilterTopDirective } from './directives/rich-filter-top';

export const RichFilterImports = [
  RichFilterHostComponent,
  RichFilterButtonDirective,
  RichFilterButtonSlotDirective,
  RichFilterContentDirective,
  RichFilterTopDirective,
] as const;
