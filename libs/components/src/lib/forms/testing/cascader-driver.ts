import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { flushFrames, pressKey, setInputValue, textOf, tick } from '../../testing/driver-core';
import { createOverlayControlDriver, mountControl } from '../../testing/overlay-control-driver';
import { CascaderDirective } from '../cascader/headless/cascader.directive';

export const createCascaderDriver = <T>(fixture: ComponentFixture<T>) => {
  const base = createOverlayControlDriver(fixture, CascaderDirective<string>, {
    hide: (cascader) => cascader.hide(),
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

  return {
    ...base,
    cascader: base.control,

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

export const mountCascader = <T>(component: Type<T>, providers: Provider[] = []) =>
  createCascaderDriver(mountControl(component, providers));
