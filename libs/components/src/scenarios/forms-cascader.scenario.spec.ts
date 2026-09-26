import { Component, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import { delay, map } from 'rxjs';
import {
  CASCADER_LABELS,
  CASCADER_SELECTABLE_LEVELS,
  CascaderComponent,
  CascaderDataSource,
  CascaderDirective,
  CascaderNode,
  DEFAULT_CASCADER_LABELS,
  FORM_FIELD_IMPORTS,
  injectCascaderLabels,
  provideCascaderLabels,
  provideOverlay,
  toChildrenObservable,
  toPathObservable,
  toSearchObservable,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

type Place = { id: string };

const UNSTYLED_BLOCKS = 'et-scrollbar { display: block; }';

const TREE: Record<string, CascaderNode<string>[]> = {
  root: [
    { value: 'europe', label: 'Europe' },
    { value: 'asia', label: 'Asia' },
    { value: 'oceania', label: 'Oceania' },
    { value: 'antarctica', label: 'Antarctica', disabled: true },
  ],
  europe: [
    { value: 'germany', label: 'Germany' },
    { value: 'france', label: 'France' },
  ],
  germany: [
    { value: 'berlin', label: 'Berlin', isLeaf: true },
    { value: 'munich', label: 'Munich', isLeaf: true },
  ],
  france: [{ value: 'paris', label: 'Paris', hasChildren: false }],
  asia: [{ value: 'japan', label: 'Japan' }],
  japan: [{ value: 'tokyo', label: 'Tokyo', isLeaf: true }],
  oceania: [],
};

const PARENTS: Record<string, string> = Object.fromEntries(
  Object.entries(TREE).flatMap(([parent, children]) => children.map((child) => [child.value, parent])),
);

const pathTo = (value: string): CascaderNode<string>[] | null => {
  const chain: CascaderNode<string>[] = [];
  let current: string | undefined = value;

  while (current && current !== 'root') {
    const parent: string | undefined = PARENTS[current];
    const found = parent ? TREE[parent]?.find((node) => node.value === current) : undefined;

    if (!found) return null;

    chain.unshift(found);
    current = parent;
  }

  return chain.length ? chain : null;
};

const searchTree = (query: string) =>
  Object.keys(PARENTS)
    .map(pathTo)
    .filter(
      (path): path is CascaderNode<string>[] => !!path?.at(-1)?.label.toLowerCase().includes(query.toLowerCase()),
    );

const placesSource: CascaderDataSource<string> = {
  loadChildren: (parent) => TREE[parent?.value ?? 'root'] ?? [],
  resolvePath: pathTo,
  search: searchTree,
};

const toPlaceNodes = (nodes: CascaderNode<string>[]): CascaderNode<Place>[] =>
  nodes.map((node) => ({ ...node, value: { id: node.value } }));

const slowPlacesSource = (ms: number): CascaderDataSource<Place> => ({
  loadChildren: (parent) => toChildrenObservable(toPlaceNodes(TREE[parent?.value.id ?? 'root'] ?? [])).pipe(delay(ms)),
  resolvePath: (value) =>
    toPathObservable(pathTo(value.id)).pipe(
      map((path) => path && toPlaceNodes(path)),
      delay(ms),
    ),
  search: (query) => toSearchObservable(searchTree(query).map(toPlaceNodes)).pipe(delay(ms)),
});

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-trip-form',
  imports: [FORM_FIELD_IMPORTS, CascaderComponent, FormField],
  template: `
    <et-form-field>
      <et-label>Destination</et-label>
      <et-cascader
        [formField]="trip.city"
        [dataSource]="source"
        (touch)="touches = touches + 1"
        placeholder="Pick a city"
      />
    </et-form-field>
  `,
})
class TripFormComponent {
  source: CascaderDataSource<string> = { loadChildren: placesSource.loadChildren, resolvePath: pathTo };
  model = signal<{ city: string | null }>({ city: null });
  trip = form(this.model, (path) => required(path.city, { message: 'Pick a city' }));
  touches = 0;
  cascader = viewChild.required(CascaderDirective);
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-regions-form',
  imports: [CascaderComponent, ReactiveFormsModule],
  template: `
    <et-cascader
      [formControl]="control"
      [dataSource]="source"
      [compareWith]="sameId"
      [selectableLevels]="anyLevel"
      [maxVisibleColumns]="2"
      aria-label="Regions"
      multiple
    />
  `,
})
class RegionsFormComponent {
  source = slowPlacesSource(20);
  anyLevel = CASCADER_SELECTABLE_LEVELS.ANY;
  control = new FormControl<Place[]>([], { nonNullable: true });
  sameId = (a: Place, b: Place) => a.id === b.id;
  cascader = viewChild.required(CascaderDirective);
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-localized-cascader',
  imports: [CascaderComponent],
  providers: [provideCascaderLabels({ search: 'Orte suchen', noMatches: 'Nichts gefunden', options: 'Kontinente' })],
  template: `<et-cascader [(value)]="city" [dataSource]="source" aria-label="Stadt" />`,
})
class LocalizedCascaderComponent {
  source = placesSource;
  city = signal<string | null>(null);
  labels = injectCascaderLabels();
}

@Component({
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  selector: 'et-scenario-token-cascader',
  imports: [CascaderComponent],
  providers: [{ provide: CASCADER_LABELS, useValue: (locale: string) => ({ noOptions: `Leer (${locale})` }) }],
  template: `<et-cascader [(value)]="city" [dataSource]="source" aria-label="City" />`,
})
class TokenCascaderComponent {
  source = placesSource;
  city = signal<string | null>(null);
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const columns = () => queryAll('[role="group"]');

const columnLabels = (index: number) =>
  queryAll('[role="treeitem"]', columns()[index] ?? document.createElement('div')).map(text);

const node = (label: string) => {
  const found = queryAll('[role="treeitem"]').find((candidate) => text(candidate) === label);

  if (!found) throw new Error(`no node ${label} in ${queryAll('[role="treeitem"]').map(text).join(', ')}`);

  return found;
};

const focusedLabel = () => text(queryAll('[role="treeitem"][data-focused]').at(-1));

const settle = (s: Scenario, ms = 0) => {
  s.tick(ms);
  s.frame(2);
  s.tick();
  s.flush();
};

const typeInto = (s: Scenario, input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  settle(s);
};

describe('forms cascader scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

  it('drills by keyboard into a signal form, commits a leaf and reports touch and the required error', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TripFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    settle(s);

    const trigger = query('[role="combobox"]', host);

    expect(trigger.getAttribute('aria-haspopup')).toBe('tree');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-required')).toBe('true');
    expect(trigger.getAttribute('aria-labelledby')).toBe(query('et-label', host).id);
    expect(text(query('.et-cascader-value', host))).toBe('Pick a city');

    trigger.focus();
    trigger.blur();
    s.tick();
    expect(app.trip.city().touched()).toBe(true);
    expect(app.touches).toBe(1);
    expect(trigger.getAttribute('aria-invalid')).toBe('true');

    trigger.focus();
    s.keydown('ArrowDown', trigger);
    settle(s);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(query('[role="tree"]').id).toBe(trigger.getAttribute('aria-controls'));
    expect(columns().map((column) => column.getAttribute('aria-label'))).toEqual([DEFAULT_CASCADER_LABELS.options]);
    expect(columnLabels(0)).toEqual(['Europe', 'Asia', 'Oceania', 'Antarctica']);
    expect(node('Antarctica').getAttribute('aria-disabled')).toBe('true');
    expect(node('Europe').getAttribute('aria-level')).toBe('1');
    expect(focusedLabel()).toBe('Europe');
    expect(document.activeElement).toBe(node('Europe'));

    s.keydown('End', node('Europe'));
    s.tick();
    expect(focusedLabel()).toBe('Antarctica');
    s.keydown('Home', node('Antarctica'));
    s.keydown('o', node('Europe'));
    s.tick();
    expect(focusedLabel()).toBe('Oceania');

    s.keydown('ArrowRight', node('Oceania'));
    settle(s);
    expect(columns()[1]?.getAttribute('aria-label')).toBe('Oceania');
    expect(text(query('.et-cascader-state--empty'))).toBe(DEFAULT_CASCADER_LABELS.noOptions);

    s.keydown('ArrowUp', node('Oceania'));
    s.keydown('ArrowUp', node('Asia'));
    s.keydown('ArrowRight', node('Europe'));
    settle(s);

    expect(node('Europe').getAttribute('aria-expanded')).toBe('true');
    expect(columnLabels(1)).toEqual(['Germany', 'France']);
    expect(node('Germany').getAttribute('aria-level')).toBe('2');
    expect(focusedLabel()).toBe('Germany');

    s.keydown('ArrowRight', node('Germany'));
    settle(s);
    expect(columnLabels(2)).toEqual(['Berlin', 'Munich']);
    expect(node('Berlin').hasAttribute('aria-expanded')).toBe(false);

    s.keydown('ArrowLeft', node('Berlin'));
    s.tick();
    expect(focusedLabel()).toBe('Germany');

    node('Munich').click();
    settle(s);

    expect(app.model().city).toBe('munich');
    expect(app.trip.city().valid()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-invalid')).toBe(false);
    expect(text(query('.et-cascader-value', host))).toBe('Europe / Germany / Munich');

    app.model.set({ city: 'tokyo' });
    settle(s);
    expect(text(query('.et-cascader-value', host))).toBe('Asia / Japan / Tokyo');

    trigger.click();
    settle(s);
    expect(node('Tokyo').getAttribute('aria-selected')).toBe('true');
    expect(node('Asia').getAttribute('aria-selected')).toBe('true');
    expect(columnLabels(2)).toEqual(['Tokyo']);

    s.keydown('Escape', document);
    settle(s);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.focus();
    s.tick();
    query<HTMLButtonElement>('.et-input-clear', host).click();
    settle(s);
    expect(app.model().city).toBeNull();
    expect(text(query('.et-cascader-value', host))).toBe('Pick a city');
  });

  it('toggles branches and leaves of a multi cascader bound to a reactive form control', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RegionsFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const control = fixture.componentInstance.control;

    settle(s);

    const trigger = query('[role="combobox"]', host);

    expect(trigger.getAttribute('aria-label')).toBe('Regions');

    trigger.click();
    settle(s, 20);

    expect(query('[role="tree"]').getAttribute('aria-multiselectable')).toBe('true');
    expect(columnLabels(0)).toEqual(['Europe', 'Asia', 'Oceania', 'Antarctica']);

    node('Asia').click();
    settle(s, 20);
    expect(control.value).toEqual([{ id: 'asia' }]);
    expect(columnLabels(1)).toEqual(['Japan']);
    expect(node('Japan').getAttribute('aria-selected')).toBe('false');

    node('Asia').click();
    settle(s, 20);
    expect(control.value).toEqual([]);

    node('Europe').click();
    node('Europe').click();
    settle(s, 20);
    node('Germany').click();
    settle(s, 20);

    expect(control.value).toEqual([{ id: 'germany' }]);
    expect(node('Europe').hasAttribute('data-indeterminate')).toBe(true);

    node('France').click();
    settle(s, 20);
    expect(control.value).toEqual([{ id: 'germany' }, { id: 'france' }]);
    expect(node('Europe').getAttribute('aria-selected')).toBe('true');
    expect(queryAll('.et-cascader-breadcrumb').map(text)).toEqual(['Europe', 'France']);

    s.keydown('Escape', document);
    settle(s);
    expect(text(query('.et-cascader-value', host))).toBe('Germany, France');

    control.setValue([{ id: 'tokyo' }]);
    settle(s, 20);
    expect(text(query('.et-cascader-value', host))).toBe('Tokyo');

    control.disable();
    s.tick();
    expect(trigger.getAttribute('aria-disabled')).toBe('true');
    trigger.click();
    settle(s);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('searches flat across levels with localized labels and jumps to branch-only matches', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LocalizedCascaderComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    settle(s);

    expect(app.labels().search).toBe('Orte suchen');
    expect(app.labels().back).toBe(DEFAULT_CASCADER_LABELS.back);

    query('[role="combobox"]', host).click();
    settle(s);

    const input = query<HTMLInputElement>('input[etCascaderSearch]');

    expect(input.placeholder).toBe('Orte suchen');
    expect(document.activeElement).toBe(input);
    expect(columns()[0]?.getAttribute('aria-label')).toBe('Kontinente');

    typeInto(s, input, 'zzz');
    expect(text(query('.et-cascader-state--empty'))).toBe('Nichts gefunden');

    typeInto(s, input, 'an');
    expect(queryAll('[role="option"]').map(text)).toEqual([
      'Oceania',
      'Antarctica',
      'Europe / Germany',
      'Europe / France',
      'Asia / Japan',
    ]);
    expect(columns()).toEqual([]);

    s.keydown('ArrowDown', input);
    s.tick();
    expect(document.activeElement?.textContent).toContain('Oceania');
    s.keydown('End', document.activeElement ?? input);
    s.tick();
    expect(text(document.activeElement)).toBe('Asia / Japan');

    (document.activeElement as HTMLElement).click();
    settle(s);
    expect(input.value).toBe('');
    expect(columnLabels(2)).toEqual(['Tokyo']);
    expect(focusedLabel()).toBe('Tokyo');

    typeInto(s, input, 'par');
    s.keydown('Enter', input);
    settle(s);
    expect(app.city()).toBe('paris');
    expect(query('[role="combobox"]', host).getAttribute('aria-expanded')).toBe('false');
  });

  it('reads a per-locale labels source provided on the CASCADER_LABELS token', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TokenCascaderComponent);

    settle(s);
    query('[role="combobox"]', fixture.nativeElement as HTMLElement).click();
    settle(s);
    s.keydown('ArrowRight', node('Oceania'));
    settle(s);

    expect(text(query('.et-cascader-state--empty'))).toMatch(/^Leer \(.+\)$/);
    s.keydown('Escape', document);
    settle(s);
  });

  it('closes an open panel without writing to the destroyed cascader', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TripFormComponent);

    settle(s);
    query('[role="combobox"]', fixture.nativeElement as HTMLElement).click();
    settle(s);
    expect(columns()).toHaveLength(1);

    fixture.destroy();
    settle(s);

    expect(s.warnings.map((entry) => String(entry.warning))).toEqual([]);
    expect(document.querySelector('.et-overlay-runtime-root')).toBeNull();
  });
});
