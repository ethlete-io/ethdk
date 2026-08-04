import { SegmentedButtonComponent } from './components/segmented-button';
import { SegmentedButtonFieldComponent } from './components/segmented-button-field';
import { SegmentedButtonGroupComponent } from './components/segmented-button-group';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const SegmentedButtonImports = [
  SegmentedButtonComponent,
  SegmentedButtonFieldComponent,
  SegmentedButtonGroupComponent,
] as const;
