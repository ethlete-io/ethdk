import { Provider, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { TEST_COLOR_THEMES } from './color-themes';
import { resetOverlays } from './driver-core';

export { createControlDriver, type ControlDriverOptions } from '../../../testing/control-driver';

/**
 * `beforeCreate` runs after the testing module is configured and before the component exists - the
 * only window where a setup that instantiates the TestBed itself (`setupQueryTest`) can run.
 */
export const mountControl = <T>(component: Type<T>, providers: Provider[] = [], beforeCreate?: () => void) => {
  resetOverlays();

  TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES), ...providers] });

  beforeCreate?.();

  const fixture = TestBed.createComponent(component);

  fixture.detectChanges();

  return fixture;
};
