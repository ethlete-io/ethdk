import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver, mountControl } from '../../testing/control-driver';
import { pressKey, textOf } from '../../testing/driver-core';
import { SelectionListDirective } from '../selection-list/headless';

export type SelectionListDriverOptions = ControlDriverOptions & {
  /** Matches the group element, when the list is not a bare `[etSelectionList]`. */
  listSelector?: string;
  /** Matches one option, when the options are not bare `[etSelectionOption]` elements. */
  optionSelector?: string;
  /** Matches the select-all control, when it is not a bare `[etSelectionListControl]`. */
  controlSelector?: string;
};

export const createSelectionListDriver = <T>(
  fixture: ComponentFixture<T>,
  {
    listSelector = '[etSelectionList]',
    optionSelector = '[etSelectionOption]',
    controlSelector = '[etSelectionListControl]',
    ...controlOptions
  }: SelectionListDriverOptions = {},
) => {
  const base = createControlDriver(fixture, SelectionListDirective, {
    directiveSelector: listSelector,
    ...controlOptions,
  });

  const listEl = () => base.query(listSelector)!;
  const optionEls = () => base.queryAll(optionSelector);
  const optionEl = (index: number) => optionEls()[index]!;
  const controlEl = () => base.query(controlSelector)!;

  return {
    ...base,
    list: base.control,

    listEl,
    attr: (name: string) => listEl().getAttribute(name),

    optionEls,
    optionEl,
    optionAttr: (index: number, name: string) => optionEl(index).getAttribute(name),
    optionAttrs: (name: string) => optionEls().map((option) => option.getAttribute(name)),
    /** The options the group renders as its own direct children, projection included. */
    childOptionEls: () => optionEls().filter((option) => option.parentElement === listEl()),

    selectOption: (index: number) => base.click(optionEl(index)),
    focusOption: (index: number) => optionEl(index).focus(),
    pressOption: (index: number, key: string) => pressKey(optionEl(index), key),

    controlAttr: (name: string) => controlEl().getAttribute(name),
    controlText: () => textOf(controlEl()),
    toggleControl: () => base.click(controlEl()),
    pressControl: (key: string) => pressKey(controlEl(), key),
  };
};

export type SelectionListDriver<T> = ReturnType<typeof createSelectionListDriver<T>>;

export const mountSelectionList = <T>(
  component: Type<T>,
  options: SelectionListDriverOptions = {},
  providers: Provider[] = [],
) => createSelectionListDriver(mountControl(component, providers), options);
