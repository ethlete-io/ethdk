import {
  afterNextRender,
  computed,
  Directive,
  effect,
  inject,
  Injector,
  input,
  signal,
  untracked,
} from '@angular/core';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './table-features';
import {
  createTableStateStorage,
  TableStateStorage,
  TableStateStorageKind,
  TableStateStorageOptions,
} from './table-state-storage';

/** Options for {@link TableStatePersistenceDirective}. */
export type TableStatePersistenceConfig = TableFeatureConfig &
  Pick<TableStateStorageOptions, 'key' | 'storage'> & {
    /** `'local'` survives a browser restart, `'session'` the tab only. @default 'local' */
    kind?: TableStateStorageKind;
  };

/**
 * Opt-in persistence for a table's setup - column order, visibility, widths, sort, filters, expanded
 * rows and whatever the imported features contribute (a selection). Restores when the table first
 * renders, and again whenever it is re-enabled or moves to another key or store; writes on every
 * other change.
 *
 * A feature rather than a table input because it is a side effect on a store, and one many tables don't
 * want: a table whose columns depend on the route or on a permission set should start from its
 * definitions every time, not from what a user left behind last month.
 *
 * @example
 * <et-table [data]="rows()" [columns]="COLUMNS" [etTableStatePersistence]="{ key: 'users-table' }" />
 *
 * <!-- for the tab only, and switchable at runtime -->
 * <et-table [etTableStatePersistence]="{ key: 'users-table', kind: 'session', enabled: remember() }" … />
 */
@Directive({
  selector: '[etTableStatePersistence]',
  exportAs: 'etTableStatePersistence',
})
export class TableStatePersistenceDirective {
  /** The host table whose state is persisted. */
  public table = injectTableFeatureHost('etTableStatePersistence');

  /** See {@link TableStatePersistenceConfig}. */
  public config = input({} as TableStatePersistenceConfig, {
    alias: 'etTableStatePersistence',
    transform: tableFeatureConfig<TableStatePersistenceConfig>,
  });

  private enabled = computed(() => this.config().enabled ?? true);

  private storageOptions = computed(
    () => {
      const { key, kind, storage } = this.config();

      return { key, kind, storage };
    },
    { equal: (a, b) => a.key === b.key && a.kind === b.kind && a.storage === b.storage },
  );

  /** The store in effect - rebuilt when the key or kind changes, so one table can move stores. */
  public storage = computed(() => createTableStateStorage(this.storageOptions()));

  private rendered = signal(false);

  constructor() {
    // Restore after the first render, not in the constructor: the columns the state refers to are
    // reconciled against the table's own definitions, which need the inputs to have arrived.
    afterNextRender(() => this.rendered.set(true), { injector: inject(Injector) });

    let restoredFrom: TableStateStorage | null = null;

    effect(() => {
      const state = this.table.state();
      const storage = this.storage();

      if (!this.rendered()) return;

      if (!this.enabled()) {
        restoredFrom = null;

        return;
      }

      // A store that has not been read yet is restored from, not written to: saving the current state
      // first would overwrite the setup it holds.
      if (restoredFrom !== storage) {
        restoredFrom = storage;

        const stored = storage.load();

        if (stored) untracked(() => this.table.restoreState(stored));

        return;
      }

      storage.save(state);
    });
  }

  /** Forget the stored setup; the table keeps its current one until something changes it. */
  public clear() {
    this.storage().clear();
  }
}
