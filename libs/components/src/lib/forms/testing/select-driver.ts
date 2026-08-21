import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { pasteInto, pointerEnter, pressKey, setInputValue, textOf, tick } from '../../testing/driver-core';
import { createOverlayControlDriver, mountControl } from '../../testing/overlay-control-driver';
import { SelectDirective } from '../select/headless/select.directive';

export const createSelectDriver = <T>(fixture: ComponentFixture<T>) => {
  const base = createOverlayControlDriver(fixture, SelectDirective, {
    triggerSelector: '[etselecttrigger], [role="combobox"]',
    hide: (select) => select.hide(),
  });

  // a trigger-inline search renders in the fixture, a panel-hosted one in the pane
  const searchInput = () =>
    (base.query<HTMLInputElement>('input[etselectsearch]') ?? base.paneEl<HTMLInputElement>('input[etselectsearch]'))!;

  const options = () => base.paneEls('[role="option"]');
  const visibleOptions = () => base.paneEls('[role="option"]:not([data-filtered])');
  const activeOption = () => base.paneEl('[role="option"][data-active]');
  const optionByLabel = (label: string) => visibleOptions().find((option) => textOf(option) === label) ?? null;
  const chips = () => base.queryAll('et-chip');
  const chipRemoveButton = (index: number) => chips()[index]!.querySelector<HTMLElement>('.et-chip-remove-button');
  const optionGroups = () => base.paneEls('[role="group"]');
  const virtualBody = () => base.paneEl('.et-select-virtual-options')!;

  return {
    ...base,
    select: base.control,

    searchInput,
    valueEl: () => base.query('.et-select-value'),
    valueText: () => textOf(base.query('.et-select-value')),
    chips,
    chipLabels: () => chips().map(textOf),
    chipRemoveButton,

    listbox: () => base.paneEl('[role="listbox"]'),
    paneText: () => textOf(base.pane()),
    options,
    visibleOptions,
    activeOption,
    activeLabel: () => textOf(activeOption()),
    optionLabels: () => options().map(textOf),
    visibleLabels: () => visibleOptions().map(textOf),
    optionByLabel,

    optionGroups,
    groupsHidden: () => optionGroups().map((group) => group.hasAttribute('hidden')),
    groupOptionCounts: () => optionGroups().map((group) => group.querySelectorAll('[role="option"]').length),
    groupLabel: (index: number) => {
      const labelledBy = optionGroups()[index]?.getAttribute('aria-labelledby');

      return labelledBy ? textOf(base.paneEl(`#${labelledBy}`)) : null;
    },

    virtualPadding: () => ({
      start: parseFloat(virtualBody().style.paddingBlockStart),
      end: parseFloat(virtualBody().style.paddingBlockEnd),
    }),

    clickOption: (index: number) => {
      options()[index]!.click();
      tick();
    },
    clickOptionByLabel: (label: string) => {
      optionByLabel(label)!.click();
      tick();
    },
    removeChip: (index: number) => {
      chipRemoveButton(index)!.click();
      tick();
    },
    hover: (element: HTMLElement) => pointerEnter(element),
    type: (text: string) => setInputValue(searchInput(), text),
    pressInSearch: (key: string) => pressKey(searchInput(), key),
    paste: (text: string) => pasteInto(searchInput(), text),
  };
};

export type SelectDriver<T> = ReturnType<typeof createSelectDriver<T>>;

export const mountSelect = <T>(component: Type<T>, providers: Provider[] = []) =>
  createSelectDriver(mountControl(component, providers));
