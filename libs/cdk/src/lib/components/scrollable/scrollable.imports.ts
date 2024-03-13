import { ScrollableComponent } from './components/scrollable';
import { ScrollableIgnoreChildDirective } from './directives/scrollable-ignore-child';
import { ScrollableIsActiveChildDirective } from './directives/scrollable-is-active-child';

export const ScrollableImports = [
  ScrollableComponent,
  ScrollableIsActiveChildDirective,
  ScrollableIgnoreChildDirective,
] as const;
