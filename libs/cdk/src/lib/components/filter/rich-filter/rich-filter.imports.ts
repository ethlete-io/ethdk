import { RichFilterHostComponent } from './components';
import {
  RichFilterButtonDirective,
  RichFilterButtonSlotDirective,
  RichFilterContentDirective,
  RichFilterTopDirective,
} from './directives';

export const RichFilterImports = [
  RichFilterHostComponent,
  RichFilterButtonDirective,
  RichFilterButtonSlotDirective,
  RichFilterContentDirective,
  RichFilterTopDirective,
] as const;
