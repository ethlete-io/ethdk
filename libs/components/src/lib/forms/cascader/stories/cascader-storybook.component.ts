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

@Component({
  selector: 'et-sb-cascader',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-form-field>
        <et-label>{{ label() }}</et-label>
        <et-cascader
          [formField]="demoForm.value"
          [dataSource]="resolvedSource()"
          [selectableLevels]="selectableLevels()"
          [toErrorMessage]="toErrorMessage"
          [placeholder]="placeholder()"
        />
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-form-field>

      <p class="text-sm opacity-60">Form value: "{{ demoForm.value().value() ?? 'null' }}"</p>
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
  /** Fails the first load of each level and recovers on Retry — demonstrates the error state. */
  public errorMode = input(false);
  public value = input<string | null>(null);
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

  protected resolvedSource = computed<CascaderDataSource<string>>(() =>
    this.errorMode() ? this.flakySource : this.async() ? asyncSource : syncSource,
  );

  private formModel = linkedSignal(() => ({ value: this.value() }));

  public demoForm = form(this.formModel);

  protected toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Failed to load';
  }
}
