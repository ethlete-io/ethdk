import { ScrollableComponent } from './components/scrollable';
import { ScrollablePlaceholderComponent } from './components/scrollable-placeholder';
import { ScrollableIgnoreChildDirective } from './directives/scrollable-ignore-child';
import { ScrollableIsActiveChildDirective } from './directives/scrollable-is-active-child';
import { ScrollableLoadingTemplateDirective } from './directives/scrollable-loading-template';
import { ScrollablePlaceholderItemTemplateDirective } from './directives/scrollable-placeholder-item-template';
import { ScrollablePlaceholderOverlayTemplateDirective } from './directives/scrollable-placeholder-overlay-template';

export const ScrollableImports = [
  ScrollableComponent,
  ScrollableIsActiveChildDirective,
  ScrollableIgnoreChildDirective,
  ScrollableLoadingTemplateDirective,
  ScrollablePlaceholderItemTemplateDirective,
  ScrollablePlaceholderOverlayTemplateDirective,
  ScrollablePlaceholderComponent,
] as const;
