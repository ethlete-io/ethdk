import { ComponentType } from '@angular/cdk/portal';
import { ComponentWithError, ComponentWithOption } from '../private';

export interface ComboboxConfig {
  /**
   * A component used to display the selected options inside the input
   */
  selectedOptionComponent?: ComponentWithOption;

  /**
   * A component used to display the options inside the body
   */
  optionComponent?: ComponentWithOption;

  /**
   * A component used to display the error inside the body
   */
  bodyErrorComponent?: ComponentWithError;

  /**
   * A component used to display the loading state inside the body
   */
  bodyLoadingComponent?: ComponentType<unknown>;

  /**
   * A component used to display the empty state inside the body
   */
  bodyEmptyComponent?: ComponentType<unknown>;

  /**
   * A component used to display the hint inside the body when there are more items than the ones displayed
   */
  bodyMoreItemsHintComponent?: ComponentType<unknown>;

  /**
   * The text to display when the body is empty and no custom empty component is provided
   *
   * @default 'No results found'
   */
  bodyEmptyText?: string;
}
