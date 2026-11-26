import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions } from '../../testing/control-driver';
import { flushFrames, pressKey, setInputValue, textOf, tick } from '../../testing/driver-core';
import { FakeMatchMedia, fakeMatchMedia } from '../../testing/fake-match-media';
import { createOverlayControlDriver, mountControl } from '../../testing/overlay-control-driver';
import { CascaderDirective } from '../cascader/headless/cascader.directive';

/** A width inside `xs`, so the panel's `{ max: 'sm' }` query matches and it presents as a sheet. */
export const SHEET_VIEWPORT_WIDTH = 375;

/** A width above `md`, where the anchored (column) presentation applies. */
export const DESKTOP_VIEWPORT_WIDTH = 1280;

export const createCascaderDriver = <T>(
  fixture: ComponentFixture<T>,
  controlOptions: ControlDriverOptions = {},
  viewport: FakeMatchMedia | null = null,
) => {
  const base = createOverlayControlDriver(fixture, CascaderDirective<string>, {
    hide: (cascader) => cascader.hide(),
    ...controlOptions,
  });

  const columns = () => base.paneEls('[role="group"]');
  const nodesIn = (columnIndex: number) =>
    Array.from(columns()[columnIndex]?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []);
  const nodeByLabel = (label: string) =>
    base.paneEls('[role="treeitem"]').find((node) => textOf(node) === label) ?? null;

  const crumbs = () => base.paneEls('.et-cascader-breadcrumb');
  const searchInput = () => base.paneEl<HTMLInputElement>('.et-cascader-search input');
  const results = () => base.paneEls('[role="option"]');

  const clickNode = (label: string) => {
    nodeByLabel(label)!.click();
    tick();
  };

  const backButton = () => base.paneEl<HTMLButtonElement>('.et-cascader-back');
  const titleSlot = () => base.paneEl('.et-cascader-sheet-title-slot');
  const sheetTitles = () => base.paneEls('.et-cascader-sheet-title');

  return {
    ...base,
    cascader: base.control,
    /** The installed breakpoint fake, when the driver was mounted with `{ sheet: true }`. */
    viewport,

    panel: () => base.paneEl('.et-cascader-panel'),
    valueText: () => textOf(base.query('.et-cascader-value')),

    columns,
    nodesIn,
    nodeLabels: (columnIndex: number) => nodesIn(columnIndex).map(textOf),
    nodeByLabel,
    clickNode,
    drillTo: (labels: string[]) => labels.forEach(clickNode),
    pressOnNode: (label: string, key: string) => pressKey(nodeByLabel(label)!, key),

    crumbs,
    crumbLabels: () => crumbs().map(textOf),
    clickCrumb: (index: number) => {
      crumbs()[index]!.click();
      tick();
    },

    isSheet: () => base.paneEl('.et-cascader-panel')?.hasAttribute('data-sheet') ?? false,
    sheetBody: () => base.paneEl('.et-cascader-sheet-body'),
    sheetHeader: () => base.paneEl('.et-cascader-sheet-header'),
    sheetColumnArea: () => base.paneEl('.et-cascader-columns[data-sheet]'),
    backButton,
    backLabel: () => textOf(backButton()),
    clickBack: () => {
      backButton()!.click();
      tick();
    },
    titleSlot,
    sheetTitles,
    sheetTitleTexts: () => sheetTitles().map(textOf),

    searchInput,
    results,
    resultLabels: () => results().map(textOf),
    clickResult: (index: number) => {
      results()[index]!.click();
      tick();
    },
    pressInSearch: (key: string) => pressKey(searchInput()!, key),
    pressOnResult: (index: number, key: string) => pressKey(results()[index]!, key),

    // the flat search runs through a data source, so the results need a frame to arrive
    type: async (text: string) => {
      setInputValue(searchInput()!, text);
      await flushFrames();
      tick();
    },
  };
};

export type CascaderDriver<T> = ReturnType<typeof createCascaderDriver<T>>;

export type CascaderMountOptions = ControlDriverOptions & {
  /**
   * Installs the breakpoint fake at `SHEET_VIEWPORT_WIDTH` before the fixture exists, so the
   * panel's `{ max: 'sm' }` query matches and it presents as a bottom sheet. Must happen before
   * the first inject that reads a media query, which is why it lives in the mount and not in a
   * test body - the breakpoint observer binds `matchMedia` once, at first inject.
   */
  sheet?: boolean;
};

export const mountCascader = <T>(
  component: Type<T>,
  providers: Provider[] = [],
  { sheet, ...controlOptions }: CascaderMountOptions = {},
) => {
  const viewport = sheet ? fakeMatchMedia() : null;

  viewport?.setViewportWidth(SHEET_VIEWPORT_WIDTH);

  return createCascaderDriver(mountControl(component, providers), controlOptions, viewport);
};
