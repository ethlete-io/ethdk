import { Component, ViewEncapsulation, computed, input, linkedSignal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { Observable, of, throwError, timer } from 'rxjs';
import { delay, switchMap } from 'rxjs/operators';
import { FORM_FIELD_IMPORTS } from '../../form-field';
import { CascaderDataSource, CascaderNode, CascaderSelectableLevels } from '../headless';
import { CASCADER_IMPORTS } from '../cascader.imports';

// competition → stage → tournament → match, a static tree used by the sync story
const TREE: Record<string, CascaderNode<string>[]> = {
  root: [
    { value: 'euro', label: 'UEFA Euro' },
    { value: 'wc', label: 'World Cup' },
    { value: 'cl', label: 'Champions League' },
  ],
  euro: [
    { value: 'euro-group', label: 'Group stage' },
    { value: 'euro-ko', label: 'Knockout stage' },
  ],
  wc: [
    { value: 'wc-group', label: 'Group stage' },
    { value: 'wc-ko', label: 'Knockout stage' },
  ],
  cl: [
    { value: 'cl-league', label: 'League phase' },
    { value: 'cl-ko', label: 'Knockout phase' },
  ],
  'euro-group': [
    { value: 'euro-group-a', label: 'Group A', isLeaf: true },
    { value: 'euro-group-b', label: 'Group B', isLeaf: true },
    { value: 'euro-group-c', label: 'Group C', isLeaf: true },
  ],
  'euro-ko': [
    { value: 'euro-r16', label: 'Round of 16', isLeaf: true },
    { value: 'euro-qf', label: 'Quarter-finals', isLeaf: true },
    { value: 'euro-sf', label: 'Semi-finals', isLeaf: true },
    { value: 'euro-final', label: 'Final', isLeaf: true },
  ],
  'wc-group': [
    { value: 'wc-group-a', label: 'Group A', isLeaf: true },
    { value: 'wc-group-b', label: 'Group B', isLeaf: true },
  ],
  'wc-ko': [{ value: 'wc-final', label: 'Final', isLeaf: true }],
  'cl-league': [{ value: 'cl-md1', label: 'Matchday 1', isLeaf: true }],
  'cl-ko': [
    { value: 'cl-qf', label: 'Quarter-finals', isLeaf: true },
    { value: 'cl-final', label: 'Final', isLeaf: true },
  ],
};

const syncSource: CascaderDataSource<string> = {
  loadChildren: (parent) => TREE[parent ? parent.value : 'root'] ?? [],
};

// same tree, but each level resolves over the wire (Observable with latency)
const asyncSource: CascaderDataSource<string> = {
  loadChildren: (parent): Observable<CascaderNode<string>[]> =>
    of(TREE[parent ? parent.value : 'root'] ?? []).pipe(delay(600)),
};

// flat search over the static tree: a depth-first walk collecting every matching path
const searchTree = (query: string): CascaderNode<string>[][] => {
  const results: CascaderNode<string>[][] = [];
  const needle = query.toLowerCase();

  const walk = (key: string, ancestors: CascaderNode<string>[]) => {
    for (const node of TREE[key] ?? []) {
      const path = [...ancestors, node];

      if (node.label.toLowerCase().includes(needle)) {
        results.push(path);
      }

      walk(node.value, path);
    }
  };

  walk('root', []);

  return results;
};

// the sync tree plus a `search` hook — its presence is what enables the panel's search input
const searchableSource: CascaderDataSource<string> = {
  loadChildren: syncSource.loadChildren,
  search: (query) => of(searchTree(query)).pipe(delay(400)),
};

// a generated six-level hierarchy (region → … → player) for the deep-nesting story — deeper
// than maxVisibleColumns, so older levels collapse into the breadcrumb row
const DEEP_LEVEL_NAMES = ['Region', 'Country', 'League', 'Club', 'Team', 'Player'];

const deepSource: CascaderDataSource<string> = {
  loadChildren: (parent) => {
    const depth = parent ? parent.value.split('/').length : 0;
    const name = DEEP_LEVEL_NAMES[depth] ?? '';

    return Array.from({ length: 6 }, (_, index) => ({
      value: parent ? `${parent.value}/${index}` : `${index}`,
      label: `${name} ${index + 1}`,
      isLeaf: depth === DEEP_LEVEL_NAMES.length - 1,
    }));
  },
};

@Component({
  selector: 'et-sb-cascader',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      @if (multiple()) {
        <et-form-field>
          <et-label>{{ label() }}</et-label>
          <et-cascader
            [(mixed)]="mixedState"
            [formField]="multiForm.value"
            [dataSource]="resolvedSource()"
            [selectableLevels]="selectableLevels()"
            [toErrorMessage]="toErrorMessage"
            [mixedLabel]="mixedLabel()"
            [placeholder]="placeholder()"
            multiple
          />
          @if (hint()) {
            <et-hint>{{ hint() }}</et-hint>
          }
        </et-form-field>

        @if (showMixedState()) {
          <div class="text-sm opacity-60">
            <p>Raw form value: {{ multiFormValue() }}</p>
            <p>Mixed: {{ mixedState() }}</p>
          </div>
        } @else {
          <p class="text-sm opacity-60">Form value: {{ multiFormValue() }}</p>
        }
      } @else {
        <et-form-field>
          <et-label>{{ label() }}</et-label>
          <et-cascader
            [(mixed)]="mixedState"
            [formField]="demoForm.value"
            [dataSource]="resolvedSource()"
            [selectableLevels]="selectableLevels()"
            [toErrorMessage]="toErrorMessage"
            [mixedLabel]="mixedLabel()"
            [placeholder]="placeholder()"
          />
          @if (hint()) {
            <et-hint>{{ hint() }}</et-hint>
          }
        </et-form-field>

        @if (showMixedState()) {
          <div class="text-sm opacity-60">
            <p>Raw form value: "{{ demoForm.value().value() ?? 'null' }}"</p>
            <p>Mixed: {{ mixedState() }}</p>
          </div>
        } @else {
          <p class="text-sm opacity-60">Form value: "{{ demoForm.value().value() ?? 'null' }}"</p>
        }
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [...FORM_FIELD_IMPORTS, ...CASCADER_IMPORTS, FormField, ProvideColorDirective],
})
export class CascaderStorybookComponent {
  public label = input('Match');
  public hint = input('');
  public placeholder = input('Browse competitions');
  public selectableLevels = input<CascaderSelectableLevels>('leaf');
  public async = input(false);
  /** Adds a `search` hook to the data source, enabling the panel's flat search input. */
  public searchable = input(false);
  /** Swaps in the generated six-level hierarchy to demo the breadcrumb collapse. */
  public deep = input(false);
  /** Multi-select: activations toggle values, parents show indeterminate states. */
  public multiple = input(false);
  /** Fails the first load of each level and recovers on Retry — demonstrates the error state. */
  public errorMode = input(false);
  public value = input<string | string[] | null>(null);
  public mixed = input(false);
  public mixedLabel = input('Mixed');
  public showMixedState = input(false);
  public color = input('brand');

  // per-level attempt tracking: the first load of a level fails, a Retry (second load) succeeds
  private flakyAttempts = new Map<string, number>();

  private flakySource: CascaderDataSource<string> = {
    loadChildren: (parent): Observable<CascaderNode<string>[]> => {
      const key = parent ? parent.value : 'root';
      const attempts = (this.flakyAttempts.get(key) ?? 0) + 1;

      this.flakyAttempts.set(key, attempts);

      const nodes = TREE[key] ?? [];

      return attempts === 1
        ? timer(700).pipe(switchMap(() => throwError(() => new Error('Could not load — check your connection'))))
        : of(nodes).pipe(delay(500));
    },
  };

  protected resolvedSource = computed<CascaderDataSource<string>>(() => {
    if (this.errorMode()) {
      return this.flakySource;
    }

    if (this.deep()) {
      return deepSource;
    }

    if (this.searchable()) {
      return searchableSource;
    }

    return this.async() ? asyncSource : syncSource;
  });

  public mixedState = linkedSignal(() => this.mixed());

  private formModel = linkedSignal(() => {
    const value = this.value();

    return { value: Array.isArray(value) ? null : value };
  });

  public demoForm = form(this.formModel);

  private multiFormModel = linkedSignal<{ value: string[] }>(() => {
    const value = this.value();

    return { value: Array.isArray(value) ? value : [] };
  });

  public multiForm = form(this.multiFormModel);

  protected multiFormValue = computed(() => JSON.stringify(this.multiForm.value().value()));

  protected toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Failed to load';
  }
}
