import { Component, signal } from '@angular/core';
import '../../../test-helpers';
import {
  CascaderDriver,
  DESKTOP_VIEWPORT_WIDTH,
  SHEET_VIEWPORT_WIDTH,
  mountCascader,
} from '../testing/cascader-driver';
import { CASCADER_IMPORTS } from './cascader.imports';
import { CascaderDataSource, CascaderNode } from './headless/internals/cascader-tree';

const TREE: Record<string, CascaderNode<string>[]> = {
  __root__: [
    { value: 'euro', label: 'Euro' },
    { value: 'world', label: 'World Cup' },
  ],
  euro: [
    { value: 'euro-group', label: 'Group stage' },
    { value: 'euro-ko', label: 'Knockout' },
  ],
  'euro-group': [
    { value: 'euro-group-a', label: 'Group A', isLeaf: true },
    { value: 'euro-group-b', label: 'Group B', isLeaf: true },
  ],
  world: [{ value: 'world-final', label: 'Final', isLeaf: true }],
};

const syncSource: CascaderDataSource<string> = {
  loadChildren: (parent) => TREE[parent ? parent.value : '__root__'] ?? [],
};

@Component({
  template: `
    <et-cascader
      [value]="value()"
      [dataSource]="dataSource()"
      (valueChange)="value.set($event)"
      placeholder="Pick a match"
    />
  `,
  imports: [CASCADER_IMPORTS],
})
class CascaderSheetTestHost {
  value = signal<string | string[] | null>(null);
  dataSource = signal<CascaderDataSource<string>>(syncSource);
}

describe('cascader bottom sheet', () => {
  let driver: CascaderDriver<CascaderSheetTestHost>;

  beforeEach(() => {
    driver = mountCascader(CascaderSheetTestHost, [], { sheet: true });
  });

  afterEach(() => {
    driver.closeAndRemovePanes();
  });

  it('presents the panel as a sheet below the sm breakpoint', async () => {
    await driver.open();

    expect(driver.panel()).not.toBeNull();
    expect(driver.isSheet()).toBe(true);
    expect(driver.sheetBody()).not.toBeNull();
    expect(driver.sheetColumnArea()).not.toBeNull();
    expect(driver.paneEl('.et-cascader-columns-track')).toBeNull();
  });

  it('shows one column at a time and no breadcrumbs', async () => {
    await driver.open();

    expect(driver.columns()).toHaveLength(1);
    expect(driver.nodeLabels(0)).toEqual(['Euro', 'World Cup']);
    expect(driver.crumbLabels()).toEqual([]);

    driver.clickNode('Euro');
    await driver.settle();

    expect(driver.columns()).toHaveLength(1);
    expect(driver.nodeLabels(0)).toEqual(['Group stage', 'Knockout']);
    expect(driver.crumbLabels()).toEqual([]);
  });

  it('mounts the visible column inside the sheet column area', async () => {
    await driver.open();

    const area = driver.sheetColumnArea();

    expect(area).not.toBeNull();
    expect(area!.querySelectorAll('[role="treeitem"]')).toHaveLength(2);
  });

  it('hides the Back bar at the root level', async () => {
    await driver.open();

    const back = driver.backButton();

    expect(back).not.toBeNull();
    expect(back!.classList.contains('et-cascader-back--hidden')).toBe(true);
    expect(back!.getAttribute('aria-hidden')).toBe('true');
    expect(driver.sheetHeader()!.getAttribute('data-back')).toBeNull();
  });

  // The template's `[attr.tabindex]="-1"` never reaches the DOM: `ButtonDirective` declares its own
  // `[attr.tabindex]` host binding, which resolves to null on a <button> and wins on the same
  // element. The hidden Back bar is only `opacity: 0` / `pointer-events: none`, so it stays
  // keyboard-reachable at the root. Reported as a production finding; the fix is out of scope here.
  it.fails('takes the hidden Back bar out of the tab order at the root level', async () => {
    await driver.open();

    expect(driver.backButton()!.getAttribute('tabindex')).toBe('-1');
  });

  it('reveals the Back bar once a level is drilled into', async () => {
    await driver.open();
    driver.clickNode('Euro');
    await driver.settle();

    const back = driver.backButton();

    expect(back).not.toBeNull();
    expect(back!.classList.contains('et-cascader-back--hidden')).toBe(false);
    expect(back!.getAttribute('aria-hidden')).toBeNull();
    expect(back!.getAttribute('tabindex')).toBeNull();
    expect(driver.backLabel()).toBe('Back');
    expect(driver.sheetHeader()!.getAttribute('data-back')).toBe('true');
  });

  it('goes back one level when the Back bar is activated', async () => {
    await driver.open();
    driver.clickNode('Euro');
    await driver.settle();
    driver.clickNode('Group stage');
    await driver.settle();

    expect(driver.cascader.deepestColumnIndex()).toBe(2);
    expect(driver.nodeLabels(0)).toEqual(['Group A', 'Group B']);

    driver.clickBack();
    await driver.settle();

    expect(driver.cascader.deepestColumnIndex()).toBe(1);
    expect(driver.nodeLabels(0)).toEqual(['Group stage', 'Knockout']);

    driver.clickBack();
    await driver.settle();

    expect(driver.cascader.deepestColumnIndex()).toBe(0);
    expect(driver.nodeLabels(0)).toEqual(['Euro', 'World Cup']);
    expect(driver.backButton()!.classList.contains('et-cascader-back--hidden')).toBe(true);
  });

  it('moves DOM focus onto the parent node when going back', async () => {
    await driver.open();
    driver.clickNode('Euro');
    await driver.settle();
    driver.clickNode('Group stage');
    await driver.settle();

    driver.clickBack();
    await driver.settle();

    expect(driver.nodeByLabel('Group stage')).not.toBeNull();
    expect(document.activeElement).toBe(driver.nodeByLabel('Group stage'));
  });

  // A sheet drill unmounts the node that was activated (only the deepest level is rendered) and
  // nothing pulls roving focus into the new column, so focus falls back to <body>. The anchored
  // presentation keeps the activated node mounted, which is why this never surfaced there.
  // Reported as a production finding; the fix is out of scope here.
  it.fails('keeps DOM focus inside the sheet after drilling into a level', async () => {
    await driver.open();
    driver.clickNode('Euro');
    await driver.settle();

    expect(driver.panel()!.contains(document.activeElement)).toBe(true);
  });

  it('titles the sheet with the drilled parent and the placeholder at the root', async () => {
    await driver.open();

    expect(driver.sheetTitleTexts()).toEqual(['Pick a match']);

    driver.clickNode('Euro');
    await driver.settle();

    expect(driver.sheetTitleTexts()).toEqual(['Euro']);

    driver.clickBack();
    await driver.settle();

    expect(driver.sheetTitleTexts()).toEqual(['Pick a match']);
  });

  it('cross-slides the title, and fades it across the root boundary', async () => {
    await driver.open();

    const slot = driver.titleSlot();

    expect(slot).not.toBeNull();
    expect(slot!.getAttribute('data-nav')).toBeNull();

    driver.clickNode('Euro');
    await driver.settle();

    expect(driver.titleSlot()!.getAttribute('data-nav')).toBe('forward');
    expect(driver.titleSlot()!.getAttribute('data-anim')).toBe('fade');

    driver.clickNode('Group stage');
    await driver.settle();

    expect(driver.titleSlot()!.getAttribute('data-nav')).toBe('forward');
    expect(driver.titleSlot()!.getAttribute('data-anim')).toBe('slide');

    driver.clickBack();
    await driver.settle();

    expect(driver.titleSlot()!.getAttribute('data-nav')).toBe('backward');
    expect(driver.titleSlot()!.getAttribute('data-anim')).toBe('slide');

    driver.clickBack();
    await driver.settle();

    expect(driver.titleSlot()!.getAttribute('data-nav')).toBe('backward');
    expect(driver.titleSlot()!.getAttribute('data-anim')).toBe('fade');
  });

  it('swaps to the anchored presentation when the viewport grows', async () => {
    await driver.open();

    expect(driver.isSheet()).toBe(true);

    driver.viewport!.setViewportWidth(DESKTOP_VIEWPORT_WIDTH);
    driver.detectChanges();

    expect(driver.isSheet()).toBe(false);
    expect(driver.sheetBody()).toBeNull();
    expect(driver.sheetHeader()).toBeNull();
    expect(driver.paneEl('.et-cascader-columns-track')).not.toBeNull();

    driver.viewport!.setViewportWidth(SHEET_VIEWPORT_WIDTH);
    driver.detectChanges();

    expect(driver.isSheet()).toBe(true);
    expect(driver.sheetHeader()).not.toBeNull();
  });
});
