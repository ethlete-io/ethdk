import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, input, linkedSignal, numberAttribute, signal, ViewEncapsulation } from '@angular/core';
import { Subject, switchMap, tap, timer } from 'rxjs';

type JsonKind = 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'array' | 'object';

/** How long the copy button stays ticked after a successful write. */
const COPIED_RESET_MS = 1200;

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
        <div class="et-query-devtools-json-row">
          <button
            [attr.aria-expanded]="effectiveExpanded()"
            (click)="toggle()"
            class="et-query-devtools-json-toggle"
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
          <button
            [attr.aria-label]="copyLabel()"
            [title]="copyLabel()"
            [class.et-query-devtools-json-copy--copied]="copied()"
            (click)="copyValue()"
            class="et-query-devtools-json-copy"
            type="button"
          >
            {{ copied() ? '✓' : '⧉' }}
          </button>
        </div>

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
        <button
          [attr.aria-label]="copyLabel()"
          [title]="copyLabel()"
          [class.et-query-devtools-json-copy--copied]="copied()"
          (click)="copyValue()"
          class="et-query-devtools-json-copy"
          type="button"
        >
          {{ copied() ? '✓' : '⧉' }}
        </button>
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

  protected copied = signal(false);
  private copiedReset$ = new Subject<void>();

  protected copyLabel = computed(() => {
    const value = this.value();

    if (Array.isArray(value)) return `Copy array (${value.length} ${value.length === 1 ? 'item' : 'items'})`;

    if (this.kind() === 'object') {
      const count = Object.keys(value as object).length;

      return `Copy object (${count} ${count === 1 ? 'key' : 'keys'})`;
    }

    return 'Copy value';
  });

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

  constructor() {
    // Each copy restarts the tick countdown; switchMap drops the pending reset of the previous one.
    this.copiedReset$
      .pipe(
        switchMap(() => timer(COPIED_RESET_MS)),
        tap(() => this.copied.set(false)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

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

  /**
   * Containers copy their whole subtree as JSON; leaves copy something pasteable - a raw string
   * without the display quotes, so an id or url can go straight into a search box.
   */
  protected copyValue() {
    const value = this.value();
    const kind = this.kind();

    let text: string;

    try {
      if (kind === 'string') text = value as string;
      else if (kind === 'undefined') text = 'undefined';
      else text = JSON.stringify(value, null, 2);
    } catch {
      // Circular references (or a BigInt / toJSON that throws) make the subtree unserializable.
      return;
    }

    navigator.clipboard
      ?.writeText(text)
      .then(() => this.flagCopied())
      .catch(() => undefined);
  }

  private flagCopied() {
    this.copied.set(true);
    this.copiedReset$.next();
  }
}
