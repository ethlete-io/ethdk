import { ScrollableComponent } from './components';
import { ScrollableIgnoreChildDirective, ScrollableIsActiveChildDirective } from './directives';

export const ScrollableImports = [
  ScrollableComponent,
  ScrollableIsActiveChildDirective,
  ScrollableIgnoreChildDirective,
] as const;
