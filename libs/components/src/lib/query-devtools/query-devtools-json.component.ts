import { Component, computed, input, linkedSignal, numberAttribute, ViewEncapsulation } from '@angular/core';

type JsonKind = 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'array' | 'object';

const kindOf = (value: unknown): JsonKind => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonKind;
};

/**
 * A recursive, collapsible, searchable JSON tree used by the query devtools value explorer. Renders
 * the *transformed* value the app actually sees (post `transformResponse`). Self-recurses via its
 * own selector.
 */
@Component({
  selector: 'et-query-devtools-json',
  template: `
    @if (isContainer()) {
      <div class="et-query-devtools-json-node">
        <button
          [attr.aria-expanded]="effectiveExpanded()"
          (click)="toggle()"
          class="et-query-devtools-json-row et-query-devtools-json-toggle"
          type="button"
        >
          <span class="et-query-devtools-json-caret">{{ effectiveExpanded() ? '▾' : '▸' }}</span>
          @if (nodeKey() !== null) {
            <span [class.et-query-devtools-json-hit]="keyHit()" class="et-query-devtools-json-key">{{
              nodeKey()
            }}</span>
            <span class="et-query-devtools-json-colon">:</span>
          }
          <span class="et-query-devtools-json-preview">{{ preview() }}</span>
        </button>

        @if (effectiveExpanded()) {
          <div class="et-query-devtools-json-children">
            @for (entry of entries(); track entry.k) {
              <et-query-devtools-json
                [value]="entry.v"
                [nodeKey]="entry.k"
                [depth]="depth() + 1"
                [path]="childPath(entry.k)"
                [search]="search()"
                [expandedPaths]="expandedPaths()"
                [collapsedPaths]="collapsedPaths()"
                [toggleFn]="toggleFn()"
              />
            }
          </div>
        }
      </div>
    } @else {
      <div [attr.data-kind]="kind()" class="et-query-devtools-json-row et-query-devtools-json-leaf">
        @if (nodeKey() !== null) {
          <span [class.et-query-devtools-json-hit]="keyHit()" class="et-query-devtools-json-key">{{ nodeKey() }}</span>
          <span class="et-query-devtools-json-colon">:</span>
        }
        <span [class.et-query-devtools-json-hit]="valueHit()" class="et-query-devtools-json-value">{{
          display()
        }}</span>
        <button (click)="copyValue()" class="et-query-devtools-json-copy" type="button" title="Copy value">⧉</button>
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsJsonComponent],
})
export class QueryDevtoolsJsonComponent {
  public value = input<unknown>();
  public nodeKey = input<string | null>(null);
  public depth = input(0, { transform: numberAttribute });
  /** Lowercased search term; when set, the tree auto-expands and matches are highlighted. */
  public search = input('');

  /** Full path of this node from the explorer root, used as the key for persisted expansion. */
  public path = input('');
  /** Persisted paths explicitly expanded (overrides the depth default). */
  public expandedPaths = input<ReadonlySet<string> | null>(null);
  /** Persisted paths explicitly collapsed (overrides the depth default). */
  public collapsedPaths = input<ReadonlySet<string> | null>(null);
  /** When provided, expansion is externally persisted via this callback instead of local state. */
  public toggleFn = input<((path: string, expand: boolean) => void) | null>(null);

  protected kind = computed(() => kindOf(this.value()));
  protected isContainer = computed(() => this.kind() === 'array' || this.kind() === 'object');

  protected entries = computed<{ k: string; v: unknown }[]>(() => {
    const value = this.value();
    if (Array.isArray(value)) return value.map((v, i) => ({ k: String(i), v }));
    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ k, v }));
    }
    return [];
  });

  private localExpanded = linkedSignal(() => this.depth() < 1);

  protected expanded = computed(() => {
    // Externally-persisted mode: resolve from the expanded/collapsed path sets, else the depth default.
    if (this.toggleFn()) {
      const path = this.path();

      if (this.collapsedPaths()?.has(path)) return false;
      if (this.expandedPaths()?.has(path)) return true;

      return this.depth() < 1;
    }

    return this.localExpanded();
  });

  protected effectiveExpanded = computed(() => (this.search() ? true : this.expanded()));

  protected preview = computed(() => {
    const value = this.value();
    if (Array.isArray(value)) return value.length ? `[…] ${value.length}` : '[]';
    const count = value ? Object.keys(value).length : 0;
    return count ? `{…} ${count}` : '{}';
  });

  protected display = computed(() => {
    const value = this.value();
    const kind = this.kind();
    if (kind === 'string') return `"${value as string}"`;
    if (kind === 'null') return 'null';
    if (kind === 'undefined') return 'undefined';
    return String(value);
  });

  protected keyHit = computed(() => {
    const term = this.search();
    const key = this.nodeKey();
    return !!term && !!key && key.toLowerCase().includes(term);
  });

  protected valueHit = computed(() => {
    const term = this.search();
    return !!term && this.display().toLowerCase().includes(term);
  });

  protected childPath(key: string) {
    const path = this.path();
    return path ? `${path}.${key}` : key;
  }

  protected toggle() {
    const toggleFn = this.toggleFn();

    if (toggleFn) {
      toggleFn(this.path(), !this.expanded());

      return;
    }

    this.localExpanded.set(!this.localExpanded());
  }

  protected copyValue() {
    try {
      navigator.clipboard?.writeText(JSON.stringify(this.value(), null, 2));
    } catch {
      // clipboard unavailable
    }
  }
}
