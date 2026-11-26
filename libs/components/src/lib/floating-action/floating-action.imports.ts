import {
  FloatingActionAnchorDirective,
  FloatingActionScopeDirective,
  FloatingActionTopDirective,
  FloatingActionTriggerDirective,
} from './headless/floating-action-parts.directive';
import { FloatingActionDirective } from './headless/floating-action.directive';

export const FLOATING_ACTION_IMPORTS = [
  FloatingActionDirective,
  FloatingActionAnchorDirective,
  FloatingActionTriggerDirective,
  FloatingActionScopeDirective,
  FloatingActionTopDirective,
] as const;
