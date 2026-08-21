import { Provider, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import {
  flushFrames,
  hostDirective,
  hostElement,
  latestPane,
  pasteInto,
  pointerEnter,
  pressKey,
  resetOverlays,
  setInputValue,
  textOf,
  tick,
} from '../../testing/driver-core';
import { SelectDirective } from '../select/headless/select.directive';

export const createSelectDriver = <T>(fixture: ComponentFixture<T>) => {
  const select = hostDirective(fixture, SelectDirective);
  const root = fixture.nativeElement as HTMLElement;

  const query = <E extends HTMLElement = HTMLElement>(selector: string) => root.querySelector<E>(selector);
  const queryAll = <E extends HTMLElement = HTMLElement>(selector: string) =>
    Array.from(root.querySelectorAll<E>(selector));

  const pane = () => latestPane();
  const paneEl = <E extends HTMLElement = HTMLElement>(selector: string) => pane()?.querySelector<E>(selector) ?? null;
  const paneEls = <E extends HTMLElement = HTMLElement>(selector: string) =>
    Array.from(pane()?.querySelectorAll<E>(selector) ?? []);

  const trigger = () => query('[etselecttrigger], [role="combobox"]')!;

  // a trigger-inline search renders in the fixture, a panel-hosted one in the pane
  const searchInput = () =>
    (query<HTMLInputElement>('input[etselectsearch]') ?? paneEl<HTMLInputElement>('input[etselectsearch]'))!;

  const options = () => paneEls('[role="option"]');
  const visibleOptions = () => paneEls('[role="option"]:not([data-filtered])');
  const activeOption = () => paneEl('[role="option"][data-active]');
  const optionByLabel = (label: string) => visibleOptions().find((option) => textOf(option) === label) ?? null;
  const chips = () => queryAll('et-chip');
  const chipRemoveButton = (index: number) => chips()[index]!.querySelector<HTMLElement>('.et-chip-remove-button');

  const settle = async () => {
    await flushFrames();
    tick();
  };

  return {
    fixture,
    host: fixture.componentInstance,
    select,
    detectChanges: () => fixture.detectChanges(),
    tick,
    settle,

    element: () => hostElement(fixture),
    query,
    queryAll,
    trigger,
    searchInput,
    valueEl: () => query('.et-select-value'),
    valueText: () => textOf(query('.et-select-value')),
    chips,
    chipLabels: () => chips().map(textOf),
    chipRemoveButton,

    pane,
    paneEl,
    paneEls,
    listbox: () => paneEl('[role="listbox"]'),
    options,
    visibleOptions,
    activeOption,
    activeLabel: () => textOf(activeOption()),
    optionLabels: () => options().map(textOf),
    visibleLabels: () => visibleOptions().map(textOf),
    optionByLabel,

    open: async () => {
      trigger().click();
      tick();
      await settle();
    },
    close: async () => {
      select.hide();
      tick();
      await settle();
    },
    press: (key: string) => pressKey(trigger(), key),
    escape: () => pressKey(document, 'Escape'),
    click: (element: HTMLElement) => {
      element.click();
      tick();
    },
    clickOption: (index: number) => {
      options()[index]!.click();
      tick();
    },
    clickOptionByLabel: (label: string) => {
      optionByLabel(label)!.click();
      tick();
    },
    clickInPane: (selector: string) => {
      paneEl(selector)!.click();
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

export const mountSelect = <T>(component: Type<T>, providers: Provider[] = []) => {
  resetOverlays();

  TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES), ...providers] });

  const fixture = TestBed.createComponent(component);

  fixture.detectChanges();

  return createSelectDriver(fixture);
};
