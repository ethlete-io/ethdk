import { ScrollableComponent } from './components/scrollable';
import { ScrollablePlaceholderComponent } from './components/scrollable-placeholder';
import { ScrollableIgnoreChildDirective } from './directives/scrollable-ignore-child';
import { ScrollableIsActiveChildDirective } from './directives/scrollable-is-active-child';
import { ScrollableLoadingTemplateDirective } from './directives/scrollable-loading-template';
import { ScrollablePlaceholderItemTemplateDirective } from './directives/scrollable-placeholder-item-template';
import { ScrollablePlaceholderOverlayTemplateDirective } from './directives/scrollable-placeholder-overlay-template';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const ScrollableImports = [
  ScrollableComponent,
  ScrollableIsActiveChildDirective,
  ScrollableIgnoreChildDirective,
  ScrollableLoadingTemplateDirective,
  ScrollablePlaceholderItemTemplateDirective,
  ScrollablePlaceholderOverlayTemplateDirective,
  ScrollablePlaceholderComponent,
] as const;
