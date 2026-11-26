import { Provider, Type } from '@angular/core';
import { createSelectDriver } from '../../../../testing/select-driver';
import { ControlDriverOptions, mountControl } from '../../testing/control-driver';

export * from '../../../../testing/select-driver';

export const mountSelect = <T>(
  component: Type<T>,
  providers: Provider[] = [],
  controlOptions: ControlDriverOptions = {},
) => createSelectDriver(mountControl(component, providers), controlOptions);
