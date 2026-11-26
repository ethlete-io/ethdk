import { Provider, Type } from '@angular/core';
import { createFieldControlDriver, FieldControlDriverOptions } from '../../../testing/field-control-driver';
import { mountControl } from './control-driver';

export * from '../../../testing/field-control-driver';

export const mountFieldControl = <T, D>(
  component: Type<T>,
  directiveType: Type<D>,
  options: FieldControlDriverOptions = {},
  providers: Provider[] = [],
) => createFieldControlDriver(mountControl(component, providers), directiveType, options);
