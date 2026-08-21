import { DOCUMENT } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  queryDevtoolsArmedMocks,
  queryDevtoolsEntries,
  queryDevtoolsFaults,
  queryDevtoolsTokenTtls,
  setQueryDevtoolsUiMounted,
} from '@ethlete/query';
import { filter, fromEvent, tap } from 'rxjs';
import { QueryDevtoolsComponent } from '@ethlete/query-devtools';
import { QueryDevtoolsToggleComponent, wasQueryDevtoolsOpen } from '@ethlete/query-devtools/toggle';

/**
 * The query devtools behind a deferred load: renders only the floating toggle button until the panel is
 * first asked for, then downloads `<et-query-devtools>` as its own chunk and hands over. Use it instead
 * of `<et-query-devtools>` to keep the panel out of the bundle an application ships to its users.
 *
 * Everything else is identical - the same toggle, the same `Ctrl/Cmd + Alt + Q` shortcut, and a panel
 * that was open when the tab last stored its state comes back open without a click.
 *
 * @example
 * ```html
 * <et-query-devtools-lazy />
 * ```
 */
@Component({
  selector: 'et-query-devtools-lazy',
  template: `
    @defer (when load()) {
      <et-query-devtools [startOpen]="openOnLoad()" />
    } @placeholder {
      <et-query-devtools-toggle [tampered]="tampered()" (openChange)="open()" />
    } @loading {
      <et-query-devtools-toggle [tampered]="tampered()" />
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [QueryDevtoolsComponent, QueryDevtoolsToggleComponent],
})
export class QueryDevtoolsLazyComponent {
  private document = inject(DOCUMENT);

  /**
   * Whether the panel was already open in this tab. It has to be answered before the panel exists, which
   * is why the stored view state is read here rather than asked of the panel.
   */
  private restoredOpen = wasQueryDevtoolsOpen();

  protected load = signal(this.restoredOpen);

  /** A restored panel opens because it was open; one that was clicked open has to be told to. */
  protected openOnLoad = signal(false);

  /**
   * Whether anything armed is changing what the app does, for the dot on the closed toggle. The panel's
   * own badge is per-query and finer-grained; this covers what can already be armed before the panel has
   * ever been loaded - overrides and mocks restored from a previous page load, and anything an app or a
   * test armed through the API.
   */
  protected tampered = computed(
    () =>
      Object.keys(queryDevtoolsFaults()).length > 0 ||
      Object.keys(queryDevtoolsTokenTtls()).length > 0 ||
      queryDevtoolsArmedMocks().size > 0 ||
      queryDevtoolsEntries().some((entry) => (entry.overrides?.list().length ?? 0) > 0),
  );

  constructor() {
    setQueryDevtoolsUiMounted(true);
    inject(DestroyRef).onDestroy(() => setQueryDevtoolsUiMounted(false));

    // The same shortcut the panel installs, for the one press that has to happen before it exists. Once
    // the panel is loaded it owns the key, so this stops at the first press it handles.
    fromEvent<KeyboardEvent>(this.document, 'keydown')
      .pipe(
        filter(() => !this.load()),
        filter((e) => (e.ctrlKey || e.metaKey) && e.altKey && (e.code === 'KeyQ' || e.key.toLowerCase() === 'q')),
        tap((e) => {
          e.preventDefault();
          this.open();
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected open() {
    this.openOnLoad.set(true);
    this.load.set(true);
  }
}
