import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, input, linkedSignal, numberAttribute, signal, ViewEncapsulation } from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { JsonPath, QueryDevtoolsOverridesRecorder } from '@ethlete/query';
import { Subject, switchMap, tap, timer } from 'rxjs';
import { QueryDevtoolsCopyMenuComponent, QueryDevtoolsCopyPayload } from './query-devtools-copy-menu.component';
import { formatJsonPath } from './query-devtools-diff';
import { exoticOf } from './query-devtools-exotic';
import { QueryDevtoolsJsonStylesComponent } from './query-devtools-json-styles.component';
import { QueryDevtoolsOverrideMenuComponent } from './query-devtools-override-menu.component';

/** A JSON value's kind as the value explorer (and its per-node override menu) categorizes it. */
export type JsonKind = 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'array' | 'object';

type JsonEntry = { k: string; v: unknown };

/** A folded slice of a container's entries, rendered as its own collapsible row. */
type JsonChunk = { start: number; end: number; label: string };

/** How long the copy button stays ticked after a successful write. */
const COPIED_RESET_MS = 1200;

/**
 * Containers with more entries than this are not rendered directly - their children are grouped into
 * collapsed slices of this size, so a 5000-item array costs 50 rows instead of 5000.
 */
const CHUNK_SIZE = 100;

export const kindOf = (value: unknown): JsonKind => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonKind;
};

const entriesOf = (value: unknown, key?: string | null): JsonEntry[] => {
  if (Array.isArray(value)) return value.map((v, i) => ({ k: String(i), v }));

  const exotic = exoticOf(value, key);
  if (exotic) return exotic.entries ?? [];

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ k, v }));
  }
  return [];
};

/** Keeps the number of sibling slices at or below `CHUNK_SIZE` by folding recursively for huge counts. */
const chunkSizeFor = (count: number) => {
  let size = CHUNK_SIZE;
  while (count / size > CHUNK_SIZE) size *= CHUNK_SIZE;
  return size;
};

/**
 * A recursive, collapsible, searchable JSON tree used by the query devtools value explorer. Renders
 * the *transformed* value the app actually sees (post `transformResponse`). Self-recurses via its
 * own selector - both for child entries and for the folded slices of an oversized container, which
 * re-enter as the same component with a `chunk` window over the same value.
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
            @if (chunk(); as chunk) {
              <span class="et-query-devtools-json-chunk">{{ chunk.label }}</span>
            } @else if (nodeKey() !== null) {
              <span [class.et-query-devtools-json-hit]="keyHit()" class="et-query-devtools-json-key">{{
                nodeKey()
              }}</span>
              <span class="et-query-devtools-json-colon">:</span>
            }
            <span class="et-query-devtools-json-preview">{{ preview() }}</span>
            @if (annotation(); as annotation) {
              <span [title]="annotationTitle()" class="et-query-devtools-json-type">{{ annotation }}</span>
            }
          </button>
          <button
            [attr.aria-label]="copyLabel()"
            [title]="copyLabel()"
            [class.et-query-devtools-json-copy--copied]="copied()"
            (click)="copy('value')"
            class="et-query-devtools-json-copy"
            type="button"
          >
            {{ copied() ? '✓' : '⧉' }}
          </button>
          @if (addressable()) {
            <et-query-devtools-copy-menu [parentKind]="parentKind()" (pick)="copy($event)" />
          }
          @if (overrides(); as overrides) {
            <et-query-devtools-override-menu
              [value]="value()"
              [path]="jsonPath()"
              [parentKind]="parentKind()"
              [overrides]="overrides"
            />
          }
        </div>

        @if (effectiveExpanded()) {
          <div class="et-query-devtools-json-children">
            @for (childChunk of childChunks(); track childChunk.start) {
              <et-query-devtools-json
                [value]="value()"
                [chunk]="childChunk"
                [depth]="depth()"
                [path]="path()"
                [jsonPath]="jsonPath()"
                [parentKind]="parentKind()"
                [overrides]="overrides()"
                [annotations]="annotations()"
                [search]="search()"
                [expandedPaths]="expandedPaths()"
                [collapsedPaths]="collapsedPaths()"
                [toggleFn]="toggleFn()"
              />
            }
            @for (entry of visibleEntries(); track entry.k) {
              <et-query-devtools-json
                [value]="entry.v"
                [nodeKey]="entry.k"
                [depth]="depth() + 1"
                [path]="childPath(entry.k)"
                [jsonPath]="childJsonPath(entry.k)"
                [parentKind]="kind()"
                [overrides]="overrides()"
                [annotations]="annotations()"
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
        @if (annotation(); as annotation) {
          <span [title]="annotationTitle()" class="et-query-devtools-json-type">{{ annotation }}</span>
        }
        <button
          [attr.aria-label]="copyLabel()"
          [title]="copyLabel()"
          [class.et-query-devtools-json-copy--copied]="copied()"
          (click)="copy('value')"
          class="et-query-devtools-json-copy"
          type="button"
        >
          {{ copied() ? '✓' : '⧉' }}
        </button>
        @if (addressable()) {
          <et-query-devtools-copy-menu [parentKind]="parentKind()" (pick)="copy($event)" />
        }
        @if (overrides(); as overrides) {
          <et-query-devtools-override-menu
            [value]="value()"
            [path]="jsonPath()"
            [parentKind]="parentKind()"
            [overrides]="overrides"
          />
        }
      </div>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsJsonComponent, QueryDevtoolsCopyMenuComponent, QueryDevtoolsOverrideMenuComponent],
})
export class QueryDevtoolsJsonComponent {
  public value = input<unknown>();
  public nodeKey = input<string | null>(null);
  public depth = input(0, { transform: numberAttribute });
  /** Lowercased search term; when set, the tree auto-expands and matches are highlighted. */
  public search = input('');

  /**
   * When set, this node is not the value itself but a folded window over its entries. It shares the
   * container's `path` so a child's persisted expansion does not depend on where the slice borders land.
   */
  public chunk = input<JsonChunk | null>(null);

  /** Full path of this node from the explorer root, used as the key for persisted expansion. */
  public path = input('');
  /** Persisted paths explicitly expanded (overrides the depth default). */
  public expandedPaths = input<ReadonlySet<string> | null>(null);
  /** Persisted paths explicitly collapsed (overrides the depth default). */
  public collapsedPaths = input<ReadonlySet<string> | null>(null);
  /** When provided, expansion is externally persisted via this callback instead of local state. */
  public toggleFn = input<((path: string, expand: boolean) => void) | null>(null);

  /** Same node as {@link path}, but as the array-of-steps an override op targets rather than a display key. */
  public jsonPath = input<JsonPath>([]);
  /** The kind of the container holding this node, so its override menu can offer "duplicate this item". */
  public parentKind = input<JsonKind | null>(null);
  /** When provided, every node renders an override menu that arms/clears ops through it. */
  public overrides = input<QueryDevtoolsOverridesRecorder | null>(null);

  /**
   * The declared type of each field, keyed by its path with array indices as `*` (`items.*.id`) - as
   * {@link QueryDevtoolsSchemaSeed} produces it. A node with an entry labels itself with it.
   */
  public annotations = input<ReadonlyMap<string, string> | null>(null);

  protected kind = computed(() => kindOf(this.value()));
  private exotic = computed(() => exoticOf(this.value(), this.nodeKey()));

  /** One annotation covers every element of an array, so the lookup path forgets which index this is. */
  private shapePath = computed(() =>
    this.path()
      .split('.')
      .map((step) => (/^\d+$/.test(step) ? '*' : step))
      .join('.'),
  );

  protected annotation = computed(() => (this.chunk() ? null : (this.annotations()?.get(this.shapePath()) ?? null)));

  protected annotationTitle = computed(() => `Declared in the API description as ${this.annotation()}`);

  /**
   * A `Date` is object-typed but has nothing to expand into, so it renders as a leaf. A resolved
   * header provider is the other way round: a function that does expand.
   */
  protected isContainer = computed(() => {
    const exotic = this.exotic();

    if (exotic) return !!exotic.entries;

    return this.kind() === 'array' || this.kind() === 'object';
  });

  /** The entries this node covers: the container's own, or just the window a chunk stands for. */
  public ownEntries = computed<JsonEntry[]>(() => {
    const entries = entriesOf(this.value(), this.nodeKey());
    const chunk = this.chunk();

    return chunk ? entries.slice(chunk.start, chunk.end) : entries;
  });

  protected childChunks = computed(() => {
    const entries = this.ownEntries();
    if (entries.length <= CHUNK_SIZE) return [];

    return buildChunks(entries, { offset: this.chunk()?.start ?? 0, isArray: this.kind() === 'array' });
  });

  /** Entries rendered as rows - empty while they are folded into slices instead. */
  protected visibleEntries = computed(() => (this.childChunks().length ? [] : this.ownEntries()));

  /** Slices carry their window in the key so siblings persist independently of the container. */
  private togglePath = computed(() => {
    const chunk = this.chunk();

    return chunk ? `${this.path()}#${chunk.start}` : this.path();
  });

  private defaultExpanded = computed(() => !this.chunk() && this.depth() < 1);

  private localExpanded = linkedSignal(() => this.defaultExpanded());

  protected expanded = computed(() => {
    // Externally-persisted mode: resolve from the expanded/collapsed path sets, else the depth default.
    if (this.toggleFn()) {
      const path = this.togglePath();

      if (this.collapsedPaths()?.has(path)) return false;
      if (this.expandedPaths()?.has(path)) return true;

      return this.defaultExpanded();
    }

    return this.localExpanded();
  });

  /** Only slices that actually contain a match unfold while searching, so a filter stays cheap. */
  private chunkHasHit = computed(() => {
    const term = this.search();

    return (
      !!term && this.ownEntries().some((entry) => entry.k.toLowerCase().includes(term) || matchesDeep(entry, term))
    );
  });

  protected effectiveExpanded = computed(() => {
    if (!this.search()) return this.expanded();

    return this.chunk() ? this.chunkHasHit() : true;
  });

  /** What the last copy put on the clipboard, or `null` once the tick has expired. */
  protected copied = signal<QueryDevtoolsCopyPayload | null>(null);
  private copiedReset$ = new Subject<void>();

  /**
   * Whether this node has an address of its own to copy. An explorer root has no key, and a folded
   * slice stands for a range of entries rather than one path - neither can name itself.
   */
  protected addressable = computed(() => this.nodeKey() !== null && !this.chunk());

  private valueLabel = computed(() => {
    const count = this.ownEntries().length;

    if (this.chunk()) return `slice (${count} ${count === 1 ? 'entry' : 'entries'})`;

    if (this.kind() === 'array') return `array (${count} ${count === 1 ? 'item' : 'items'})`;

    if (this.kind() === 'object') return `object (${count} ${count === 1 ? 'key' : 'keys'})`;

    return 'value';
  });

  /**
   * Doubles as the button's `title` and its `aria-label`, and names what landed while the tick is up -
   * a bare `✓` stopped being unambiguous once the menu put four payloads behind one control.
   */
  protected copyLabel = computed(() => {
    const copied = this.copied();

    if (copied) return `Copied the ${copied === 'entry' ? '"key": value pair' : copied}`;

    return `Copy ${this.valueLabel()}`;
  });

  protected preview = computed(() => {
    const count = this.ownEntries().length;

    if (this.kind() === 'array') return count ? `[…] ${count}` : '[]';

    const typeName = this.exotic()?.typeName;
    if (typeName) return `${typeName}(${count})`;

    return count ? `{…} ${count}` : '{}';
  });

  protected display = computed(() => displayOf(this.value(), this.nodeKey()));

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
    injectStyleManager().mount(QueryDevtoolsJsonStylesComponent);

    // Each copy restarts the tick countdown; switchMap drops the pending reset of the previous one.
    this.copiedReset$
      .pipe(
        switchMap(() => timer(COPIED_RESET_MS)),
        tap(() => this.copied.set(null)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected childPath(key: string) {
    const path = this.path();
    return path ? `${path}.${key}` : key;
  }

  protected childJsonPath(key: string): JsonPath {
    const step: string | number = this.kind() === 'array' ? Number(key) : key;
    return [...this.jsonPath(), step];
  }

  protected toggle() {
    const toggleFn = this.toggleFn();

    if (toggleFn) {
      toggleFn(this.togglePath(), !this.expanded());

      return;
    }

    this.localExpanded.set(!this.localExpanded());
  }

  /**
   * Writes one of the node's four pasteable forms. All of them go through here so the tick stays a
   * single readout of what actually landed.
   */
  protected copy(payload: QueryDevtoolsCopyPayload) {
    const text = this.copyTextFor(payload);

    if (text === null) return;

    navigator.clipboard
      ?.writeText(text)
      .then(() => this.flagCopied(payload))
      .catch(() => undefined);
  }

  /**
   * Containers copy their whole subtree as JSON, slices only the entries they cover; leaves copy
   * something pasteable - a raw string without the display quotes, so an id or url can go straight
   * into a search box. `null` for a subtree that cannot be serialized at all.
   */
  private copyTextFor(payload: QueryDevtoolsCopyPayload): string | null {
    if (payload === 'key') return this.nodeKey();
    if (payload === 'path') return formatJsonPath(this.jsonPath());

    const kind = this.kind();
    const exotic = this.exotic();
    const value = this.chunk() ? this.chunkValue() : this.copyableValue();

    try {
      if (payload === 'entry') return `${JSON.stringify(this.nodeKey())}: ${JSON.stringify(value, null, 2)}`;

      if (kind === 'string') return value as string;
      if (kind === 'undefined') return 'undefined';
      if (exotic?.display) return exotic.display;

      return JSON.stringify(value, null, 2);
    } catch {
      // Circular references (or a BigInt / toJSON that throws) make the subtree unserializable.
      return null;
    }
  }

  /** An exotic container copies the entries the tree shows, not the private fields `JSON.stringify` finds. */
  private copyableValue() {
    const entries = this.exotic()?.entries;

    return entries ? Object.fromEntries(entries.map((entry) => [entry.k, entry.v])) : this.value();
  }

  private chunkValue() {
    const entries = this.ownEntries();

    if (this.kind() === 'array') return entries.map((entry) => entry.v);

    return Object.fromEntries(entries.map((entry) => [entry.k, entry.v]));
  }

  private flagCopied(payload: QueryDevtoolsCopyPayload) {
    this.copied.set(payload);
    this.copiedReset$.next();
  }
}

// Below the component: an interpolated template literal above an inline template breaks the Angular
// language service for the whole template (see `ethlete/no-template-literal-before-inline-template`).

const displayOf = (value: unknown, key?: string | null) => {
  const exotic = exoticOf(value, key);
  if (exotic?.display) return `${exotic.typeName}(${exotic.display})`;

  switch (kindOf(value)) {
    case 'string':
      return `"${value as string}"`;
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    default:
      return String(value);
  }
};

const buildChunks = (entries: JsonEntry[], window: { offset: number; isArray: boolean }): JsonChunk[] => {
  const size = chunkSizeFor(entries.length);
  const chunks: JsonChunk[] = [];

  for (let i = 0; i < entries.length; i += size) {
    const slice = entries.slice(i, i + size);
    const start = window.offset + i;
    const end = start + slice.length;
    const first = window.isArray ? String(start) : (slice[0]?.k ?? '');
    const last = window.isArray ? String(end - 1) : (slice[slice.length - 1]?.k ?? '');

    chunks.push({ start, end, label: slice.length === 1 ? first : `${first} … ${last}` });
  }

  return chunks;
};

/** Whether a search term appears anywhere in a subtree - used to keep non-matching slices folded. */
const matchesDeep = (entry: JsonEntry, term: string): boolean => {
  const { k, v } = entry;
  const exotic = exoticOf(v, k);

  if (exotic ? !exotic.entries : !v || typeof v !== 'object') {
    return displayOf(v, k).toLowerCase().includes(term);
  }

  return entriesOf(v, k).some((child) => child.k.toLowerCase().includes(term) || matchesDeep(child, term));
};
