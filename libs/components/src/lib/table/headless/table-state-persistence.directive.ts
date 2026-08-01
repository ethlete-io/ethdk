import { afterNextRender, computed, Directive, effect, inject, Injector, input, untracked } from '@angular/core';
import { injectTableFeatureHost, TableFeatureConfig, tableFeatureConfig } from './table-features';
import { createTableStateStorage, TableStateStorageKind, TableStateStorageOptions } from './table-state-storage';
import { TableComponent } from '../table.component';

/** Options for {@link TableStatePersistenceDirective}. */
export type TableStatePersistenceConfig = TableFeatureConfig &
  Pick<TableStateStorageOptions, 'key' | 'storage'> & {
    /** `'local'` survives a browser restart, `'session'` the tab only. @default 'local' */
    kind?: TableStateStorageKind;
  };

/**
 * Opt-in persistence for a table's setup - column order, visibility, widths, sort, filters, expanded
 * rows and whatever the imported features contribute (a selection). Restores once when the table first
 * renders, then writes on every change.
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
  public table = inject<TableComponent<unknown>>(TableComponent);

  /** See {@link TableStatePersistenceConfig}. */
  public config = input({} as TableStatePersistenceConfig, {
    alias: 'etTableStatePersistence',
    transform: tableFeatureConfig<TableStatePersistenceConfig>,
  });

  private enabled = computed(() => this.config().enabled ?? true);

  /** The store in effect - rebuilt when the key or kind changes, so one table can move stores. */
  public storage = computed(() => {
    const { key, kind, storage } = this.config();

    return createTableStateStorage({ key, kind, storage });
  });

  constructor() {
    // Registered through the feature host so `[etTableStatePersistence]` outside a table throws the
    // same labelled error as every other feature.
    injectTableFeatureHost('etTableStatePersistence');

    // Restore after the first render, not in the constructor: the columns the state refers to are
    // reconciled against the table's own definitions, which need the inputs to have arrived.
    afterNextRender(
      () => {
        if (!untracked(this.enabled)) return;

        const stored = untracked(this.storage).load();

        if (stored) this.table.restoreState(stored);
      },
      { injector: inject(Injector) },
    );

    let restored = false;

    effect(() => {
      const state = this.table.state();
      const enabled = this.enabled();
      const storage = this.storage();

      // Skip the very first value: it is the table's own defaults, and writing it would overwrite a
      // stored setup before the restore above has had its render.
      if (!restored) {
        restored = true;

        return;
      }

      if (enabled) storage.save(state);
    });
  }

  /** Forget the stored setup; the table keeps its current one until something changes it. */
  public clear() {
    this.storage().clear();
  }
}
