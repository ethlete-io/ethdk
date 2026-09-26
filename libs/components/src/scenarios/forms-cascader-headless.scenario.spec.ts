import { Component, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import {
  CASCADER_ERROR_CODES,
  CascaderColumnDirective,
  CascaderDataSource,
  CascaderDirective,
  CascaderNode,
  CascaderNodeDirective,
  CascaderPanelComponent,
  CascaderSearchDirective,
  CascaderSearchOptionDirective,
  CascaderSurfaceDirective,
  CascaderTriggerDirective,
  canHaveChildren,
  defaultCompareWith,
  indexOfNode,
  nodesEqual,
  provideOverlay,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const LEAGUES: Record<string, CascaderNode<string>[]> = {
  root: [
    { value: 'north', label: 'North League' },
    { value: 'south', label: 'South League' },
    { value: 'friendly', label: 'Friendly', isLeaf: true },
  ],
  north: [
    { value: 'north-lions', label: 'Lions', isLeaf: true },
    { value: 'north-owls', label: 'Owls', isLeaf: true, disabled: true },
  ],
  south: [{ value: 'south-sharks', label: 'Sharks', isLeaf: true }],
};

const leaguePaths = () =>
  LEAGUES['root']?.flatMap((league) => [[league], ...(LEAGUES[league.value] ?? []).map((team) => [league, team])]) ??
  [];

const leagueSource: CascaderDataSource<string> = {
  loadChildren: (parent) => LEAGUES[parent?.value ?? 'root'] ?? [],
  search: (query) =>
    leaguePaths().filter((path) => path.at(-1)?.label.toLowerCase().includes(query.toLowerCase()) ?? false),
};

const HOME: CascaderNode<string> = { value: 'north-lions', label: 'Lions' };

@Component({
  selector: 'et-scenario-team-cascader',
  imports: [
    CascaderDirective,
    CascaderTriggerDirective,
    CascaderSurfaceDirective,
    CascaderPanelComponent,
    CascaderColumnDirective,
    CascaderNodeDirective,
    CascaderSearchDirective,
    CascaderSearchOptionDirective,
  ],
  template: `
    <div #picker="etCascader" [(value)]="team" [dataSource]="source" (afterClose)="closes = closes + 1" etCascader>
      <button class="team-trigger" aria-label="Team" etCascaderTrigger type="button">
        {{ picker.displayValue() ?? 'No team' }}
      </button>
      <ng-template etCascaderSurface let-cascader let-close="close">
        <et-cascader-panel>
          <input class="team-search" etCascaderSearch />
          @if (cascader.isSearching()) {
            @for (result of cascader.searchState().results; track $index) {
              <button [path]="result" [index]="$index" class="team-result" etCascaderSearchOption type="button">
                {{ result.at(-1)?.label }}
              </button>
            }
          } @else {
            @for (column of cascader.columns(); track $index; let columnIndex = $index) {
              <div [etCascaderColumn]="columnIndex" class="team-column">
                @for (node of column.nodes; track node.value) {
                  <button
                    [node]="node"
                    [class.team-home]="isHome(node)"
                    [disabled]="node.disabled"
                    class="team-node"
                    etCascaderNode
                    type="button"
                  >
                    {{ node.label }} {{ position(column.nodes, node) }}{{ canHaveChildren(node) ? ' >' : '' }}
                  </button>
                }
              </div>
            }
          }
          <button (click)="close()" class="team-done" type="button">Done</button>
        </et-cascader-panel>
      </ng-template>
    </div>
  `,
})
class TeamCascaderComponent {
  source = leagueSource;
  team = signal<unknown>(null);
  closes = 0;
  canHaveChildren = canHaveChildren;
  cascader = viewChild.required(CascaderDirective);
  surface = viewChild.required(CascaderSurfaceDirective);

  isHome(node: CascaderNode<unknown>) {
    return nodesEqual({ a: node, b: HOME, compareWith: defaultCompareWith });
  }

  position(nodes: CascaderNode<unknown>[], node: CascaderNode<unknown>) {
    return `${indexOfNode({ nodes, node, compareWith: defaultCompareWith }) + 1}/${nodes.length}`;
  }
}

@Component({
  selector: 'et-scenario-sourceless-cascader',
  imports: [CascaderDirective, CascaderTriggerDirective, CascaderSurfaceDirective],
  template: `
    <div etCascader>
      <button class="lost-trigger" etCascaderTrigger type="button">Open</button>
      <ng-template etCascaderSurface>Nothing</ng-template>
    </div>
  `,
})
class SourcelessCascaderComponent {}

@Component({
  selector: 'et-scenario-stray-cascader-trigger',
  imports: [CascaderTriggerDirective],
  template: '<button etCascaderTrigger type="button">Lost</button>',
})
class StrayTriggerComponent {}

@Component({
  selector: 'et-scenario-stray-cascader-surface',
  imports: [CascaderSurfaceDirective],
  template: '<ng-template etCascaderSurface>Lost</ng-template>',
})
class StraySurfaceComponent {}

@Component({
  selector: 'et-scenario-stray-cascader-search',
  imports: [CascaderSearchDirective],
  template: '<input etCascaderSearch />',
})
class StraySearchComponent {}

@Component({
  selector: 'et-scenario-stray-cascader-search-option',
  imports: [CascaderSearchOptionDirective],
  template: '<button [path]="path" [index]="0" etCascaderSearchOption type="button">Lost</button>',
})
class StraySearchOptionComponent {
  path = [HOME];
}

@Component({
  selector: 'et-scenario-stray-cascader-column',
  styles: ['et-scrollbar { display: block; }'],
  encapsulation: ViewEncapsulation.None,
  imports: [CascaderColumnDirective, CascaderNodeDirective],
  template: '<div [etCascaderColumn]="0"><button [node]="node" etCascaderNode type="button">Lost</button></div>',
})
class StrayColumnComponent {
  node = HOME;
}

@Component({
  selector: 'et-scenario-bare-cascader',
  imports: [CascaderDirective],
  template: '<div etCascader>Nothing</div>',
})
class BareCascaderComponent {}

@Component({
  selector: 'et-scenario-surfaceless-cascader',
  imports: [CascaderDirective, CascaderTriggerDirective],
  template: '<div etCascader><button etCascaderTrigger type="button">Open</button></div>',
})
class SurfacelessCascaderComponent {}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const settle = (s: Scenario) => {
  s.tick();
  s.frame(2);
  s.tick();
  s.flush();
};

const takeRuntimeError = (s: Scenario, code: number) => {
  s.expectError(`ET${code}`);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  if (index !== -1) s.errors.splice(index, 1);
};

describe('forms cascader headless scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

  it('composes a searchable cascader from the headless directives and the styled panel', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TeamCascaderComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    settle(s);

    const trigger = query('.team-trigger', host);

    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.hasAttribute('tabindex')).toBe(false);
    expect(app.surface().templateRef).toBeTruthy();

    trigger.click();
    settle(s);

    const panel = query('et-cascader-panel');

    expect(panel.getAttribute('role')).toBe('tree');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
    expect(queryAll('.team-node').map(text)).toEqual(['North League 1/3 >', 'South League 2/3 >', 'Friendly 3/3']);
    expect(document.activeElement).toBe(query('.team-search'));

    queryAll('.team-node')[0]?.click();
    settle(s);

    expect(queryAll('.team-column').map((column) => column.getAttribute('aria-label'))).toEqual([
      'Options',
      'North League',
    ]);
    expect(query('.team-home').getAttribute('aria-level')).toBe('2');
    expect(text(query('.team-home'))).toBe('Lions 1/2');

    s.keydown('s', query('.team-home'));
    settle(s);
    expect(query<HTMLInputElement>('.team-search').value).toBe('s');
    expect(queryAll('.team-result').map(text)).toEqual(['Lions', 'Owls', 'South League', 'Sharks']);
    expect(queryAll('.team-result').map((result) => result.getAttribute('role'))).toEqual(Array(4).fill('option'));
    expect(queryAll('.team-result')[1]?.getAttribute('aria-disabled')).toBe('true');

    s.keydown('ArrowUp', query('.team-search'));
    s.tick();
    expect(document.activeElement).toBe(queryAll('.team-result')[3]);
    s.keydown('Home', queryAll('.team-result')[3] ?? document);
    s.tick();
    expect(document.activeElement).toBe(queryAll('.team-result')[0]);
    s.keydown('ArrowUp', queryAll('.team-result')[0] ?? document);
    s.tick();
    expect(document.activeElement).toBe(query('.team-search'));

    queryAll('.team-result')[1]?.click();
    s.tick();
    expect(app.team()).toBeNull();

    queryAll('.team-result')[3]?.click();
    settle(s);
    expect(app.team()).toBe('south-sharks');
    expect(app.closes).toBe(1);
    expect(text(trigger)).toBe('South League / Sharks');

    trigger.click();
    settle(s);
    expect(queryAll('.team-node[aria-selected="true"]').map(text)).toEqual(['South League 2/3 >', 'Sharks 1/1']);

    query('.team-done').click();
    settle(s);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(app.closes).toBe(2);
  });

  it('reports a runtime error when a cascader opens without a data source', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SourcelessCascaderComponent);

    settle(s);
    expect(() => {
      query('.lost-trigger', fixture.nativeElement as HTMLElement).click();
      settle(s);
    }).toThrow(`ET${CASCADER_ERROR_CODES.MISSING_DATA_SOURCE}`);
    settle(s);
    expect(s.errors.splice(0).map((entry) => entry.source)).toEqual(['console.error']);
  });

  it.each([
    ['a trigger', StrayTriggerComponent, [CASCADER_ERROR_CODES.TRIGGER_OUTSIDE_CASCADER]],
    ['a surface', StraySurfaceComponent, [CASCADER_ERROR_CODES.SURFACE_OUTSIDE_CASCADER]],
    ['a search input', StraySearchComponent, [CASCADER_ERROR_CODES.SEARCH_OUTSIDE_CASCADER]],
    ['a search option', StraySearchOptionComponent, [CASCADER_ERROR_CODES.SEARCH_OPTION_OUTSIDE_CASCADER]],
    [
      'a column and its node',
      StrayColumnComponent,
      [CASCADER_ERROR_CODES.COLUMN_OUTSIDE_CASCADER, CASCADER_ERROR_CODES.NODE_OUTSIDE_COLUMN],
    ],
    ['a cascader without a trigger', BareCascaderComponent, [CASCADER_ERROR_CODES.MISSING_TRIGGER]],
    ['a cascader without a surface', SurfacelessCascaderComponent, [CASCADER_ERROR_CODES.MISSING_SURFACE]],
  ])('reports a runtime error for %s outside a cascader', (_label, component, codes) => {
    const s = scenario();

    TestBed.createComponent(component);
    s.tick();
    s.flush();

    codes.forEach((code) => takeRuntimeError(s, code));
  });
});
