import { ScrollableActiveChildDirective } from './headless/scrollable-active-child.directive';
import { ScrollableIgnoreChildDirective } from './headless/scrollable-ignore-child.directive';
import { ScrollableLoadingTemplateDirective } from './headless/scrollable-loading-template.directive';
import { ScrollableComponent } from './scrollable.component';

export const SCROLLABLE_IMPORTS = [
  ScrollableComponent,
  ScrollableActiveChildDirective,
  ScrollableIgnoreChildDirective,
  ScrollableLoadingTemplateDirective,
] as const;
