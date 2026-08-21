import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver, mountControl } from '../../testing/control-driver';
import { SwitchDirective } from '../switch/headless';

const SWITCH = '[etSwitch]';

export const createSwitchDriver = <T>(fixture: ComponentFixture<T>, options: ControlDriverOptions = {}) => {
  const base = createControlDriver(fixture, SwitchDirective, { directiveSelector: SWITCH, ...options });

  const switchEl = () => base.query(SWITCH)!;

  return {
    ...base,
    switch: base.control,

    attr: (name: string) => switchEl().getAttribute(name),
    toggle: () => base.click(switchEl()),
  };
};

export type SwitchDriver<T> = ReturnType<typeof createSwitchDriver<T>>;

export const mountSwitch = <T>(component: Type<T>, options: ControlDriverOptions = {}, providers: Provider[] = []) =>
  createSwitchDriver(mountControl(component, providers), options);
