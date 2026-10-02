import { Provider, Type } from '@angular/core';
import { createDatePickerDriver } from '../../../../testing/date-picker-driver';
import { ControlDriverOptions, mountControl } from '../../testing/control-driver';

export * from '../../../../testing/date-picker-driver';

export const mountDatePicker = <T, D extends { closePicker: () => void }>(
  component: Type<T>,
  directiveType: Type<D>,
  providers: Provider[] = [],
  options: ControlDriverOptions = {},
) => createDatePickerDriver(mountControl(component, providers), directiveType, options);
