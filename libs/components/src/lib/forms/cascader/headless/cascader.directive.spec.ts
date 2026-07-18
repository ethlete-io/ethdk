import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { CASCADER_IMPORTS } from '../cascader.imports';
import { CascaderDirective } from './cascader.directive';
import { CascaderDataSource, CascaderNode } from './internals/cascader-tree';

const TEST_COLOR_THEMES = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: { default: '0 0 0', disabled: '0 36 23' },
    },
  },
  {
    name: 'red',
    type: 'error' as const,
    primary: {
      color: { default: '255 0 0', hover: '255 76 76', focus: '255 76 76', active: '198 0 0', disabled: '128 32 32' },
      onColor: { default: '0 0 0', disabled: '48 0 0' },
    },
  },
] as const;

// competition → stage → tournament, three levels, synchronous
const TREE: Record<string, CascaderNode<string>[]> = {
  __root__: [
    { value: 'euro', label: 'Euro' },
    { value: 'world', label: 'World Cup' },
    { value: 'empty-comp', label: 'Empty competition' },
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
  'empty-comp': [],
};

const syncSource: CascaderDataSource<string> = {
  loadChildren: (parent) => TREE[parent ? parent.value : '__root__'] ?? [],
};

@Component({
  template: `
    <et-cascader
      [value]="value()"
      [dataSource]="dataSource()"
      [selectableLevels]="selectableLevels()"
      [disabled]="disabled()"
      (valueChange)="value.set($event)"
      (touchedChange)="touched.set($event)"
      placeholder="Pick a match"
    />
  `,
  imports: [CASCADER_IMPORTS],
})
class CascaderTestHost {
  value = signal<string | null>(null);
  touched = signal(false);
  disabled = signal(false);
  selectableLevels = signal<'leaf' | 'any'>('leaf');
  dataSource = signal<CascaderDataSource<string>>(syncSource);
}

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('CascaderDirective', () => {
  let fixture: ComponentFixture<CascaderTestHost>;
  let cascader: CascaderDirective<string>;
  let trigger: HTMLElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const open = async () => {
    trigger.click();
    tick();
    await flushFrames();
    tick();
  };

  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const columns = () => Array.from(pane()?.querySelectorAll<HTMLElement>('[role="group"]') ?? []);
  const nodesIn = (columnIndex: number) =>
    Array.from(columns()[columnIndex]?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []);
  const nodeByLabel = (label: string) =>
    Array.from(pane()?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []).find(
      (node) => node.textContent?.trim() === label,
    ) ?? null;

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [CascaderTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(CascaderTestHost);
    fixture.detectChanges();
    cascader = fixture.debugElement.children[0]!.injector.get(CascaderDirective);
    trigger = fixture.nativeElement.querySelector('[role="combobox"]');
  });

  afterEach(async () => {
    cascader.hide();
    tick();
    await flushFrames();
  });

  it('renders a closed combobox trigger with a tree popup', () => {
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-haspopup')).toBe('tree');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('loads the root column on open', async () => {
    await open();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(columns().length).toBe(1);
    expect(nodesIn(0).map((node) => node.textContent?.trim())).toEqual(['Euro', 'World Cup', 'Empty competition']);
    // branch nodes advertise their expandability
    expect(nodesIn(0)[0]!.getAttribute('aria-expanded')).toBe('false');
  });

  it('drills into a branch, opening a second column', async () => {
    await open();
    nodeByLabel('Euro')!.click();
    tick();

    expect(columns().length).toBe(2);
    expect(nodesIn(1).map((node) => node.textContent?.trim())).toEqual(['Group stage', 'Knockout']);
    expect(nodeByLabel('Euro')!.getAttribute('aria-expanded')).toBe('true');
    // a branch click does not commit in leaf mode
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('commits a leaf value and closes', async () => {
    await open();
    nodeByLabel('Euro')!.click();
    tick();
    nodeByLabel('Group stage')!.click();
    tick();
    nodeByLabel('Group A')!.click();
    tick();
    await flushFrames();

    expect(fixture.componentInstance.value()).toBe('euro-group-a');
    expect(cascader.pathValue()).toEqual(['euro', 'euro-group', 'euro-group-a']);
    expect(cascader.open()).toBe(false);
  });

  it('shows the breadcrumb of the committed path on the trigger', async () => {
    await open();
    nodeByLabel('World Cup')!.click();
    tick();
    nodeByLabel('Final')!.click();
    tick();
    await flushFrames();

    expect(cascader.displayValue()).toBe('World Cup / Final');
    expect(trigger.textContent).toContain('World Cup / Final');
  });

  it('re-truncates deeper columns when a shallower branch is re-picked', async () => {
    await open();
    nodeByLabel('Euro')!.click();
    tick();
    nodeByLabel('Group stage')!.click();
    tick();
    expect(columns().length).toBe(3);

    // drilling a different root branch collapses back to two columns
    nodeByLabel('World Cup')!.click();
    tick();

    expect(columns().length).toBe(2);
    expect(nodesIn(1).map((node) => node.textContent?.trim())).toEqual(['Final']);
  });

  it('commits an intermediate branch in any-level mode without closing', async () => {
    fixture.componentInstance.selectableLevels.set('any');
    fixture.detectChanges();

    await open();
    nodeByLabel('Euro')!.click();
    tick();

    expect(fixture.componentInstance.value()).toBe('euro');
    expect(cascader.open()).toBe(true);
    expect(columns().length).toBe(2);
  });

  it('shows an empty state for a branch with no children', async () => {
    await open();
    nodeByLabel('Empty competition')!.click();
    tick();

    expect(columns()[1]!.textContent).toContain('No options');
  });

  it('moves roving focus within and across columns with the keyboard', async () => {
    await open();
    const [euro] = nodesIn(0);

    euro!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    tick();
    expect(cascader.focusedNode()?.value).toBe('world');

    euro!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    tick();
    expect(cascader.focusedNode()?.value).toBe('euro');

    // ArrowRight drills into the focused branch
    euro!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    tick();
    await flushFrames();
    expect(columns().length).toBe(2);
    expect(cascader.focusedNode()?.value).toBe('euro-group');
    expect(cascader.focusedColumn()).toBe(1);
  });

  it('does not commit or open while disabled', async () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    await open();

    expect(cascader.open()).toBe(false);
    expect(pane()).toBeNull();
  });

  it('clears the value', async () => {
    await open();
    nodeByLabel('World Cup')!.click();
    tick();
    nodeByLabel('Final')!.click();
    tick();
    await flushFrames();
    expect(fixture.componentInstance.value()).toBe('world-final');

    cascader.clearValue();
    tick();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(cascader.pathValue()).toEqual([]);
  });

  it('supports an async (promise) data source', async () => {
    const asyncSource: CascaderDataSource<string> = {
      loadChildren: (parent) => Promise.resolve(TREE[parent ? parent.value : '__root__'] ?? []),
    };

    fixture.componentInstance.dataSource.set(asyncSource);
    fixture.detectChanges();

    await open();
    // the column shows a loading state until the promise resolves
    await flushFrames();
    await Promise.resolve();
    tick();

    expect(nodesIn(0).length).toBe(3);
  });

  it('surfaces a load error with a retry control', async () => {
    let attempts = 0;
    const failingSource: CascaderDataSource<string> = {
      loadChildren: () => {
        attempts += 1;

        return attempts === 1 ? Promise.reject(new Error('boom')) : TREE['__root__']!;
      },
    };

    fixture.componentInstance.dataSource.set(failingSource);
    fixture.detectChanges();

    await open();
    await flushFrames();
    await Promise.resolve();
    await Promise.resolve();
    tick();

    const errorRow = pane()?.querySelector<HTMLElement>('.et-cascader-state--error');

    expect(errorRow).toBeTruthy();

    errorRow!.querySelector('button')!.click();
    tick();
    await flushFrames();
    await Promise.resolve();
    tick();

    expect(nodesIn(0).length).toBe(3);
  });
});
