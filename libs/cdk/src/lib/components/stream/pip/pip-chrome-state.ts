import { Signal, WritableSignal, computed, effect, signal, untracked } from '@angular/core';
import { injectPipManager } from '../pip-manager';
import { StreamPipEntry, StreamPlayerId } from '../stream-manager.types';
import type { PipWindowComponent } from './pip-window.component';

/**
 * Pre-computed layout data for a single pip cell in the Chrome stage.
 * Consumed directly in the template — no method calls needed.
 */
export type PipCellData = {
  /** The underlying pip entry. */
  pip: StreamPipEntry;
  /** Shortcut to `pip.playerId`. */
  playerId: StreamPlayerId;
  /** CSS grid column (1-based). */
  col: number;
  /** CSS grid row (1-based). */
  row: number;
  /** Horizontal exit direction offset (used for CSS `--et-cell-exit-h`). */
  exitH: number;
  /** Vertical exit direction offset (used for CSS `--et-cell-exit-v`). */
  exitV: number;
  /** Whether this is the currently featured pip. */
  isFeatured: boolean;
  /** `''` when this cell should be inert (single mode, non-featured), `null` otherwise. */
  inertAttr: '' | null;
  /** `''` when the player inside this cell should be inert, `null` otherwise. */
  playerInertAttr: '' | null;
  /** `'button'` in grid mode (cells are interactive), `null` in single mode. */
  gridRole: 'button' | null;
  /** `0` in grid mode, `null` in single mode. */
  gridTabIndex: 0 | null;
};

export type PipChromeState = {
  // ─── Writable signals ────────────────────────────────────────────────────────
  featuredId: WritableSignal<StreamPlayerId | null>;
  multiView: WritableSignal<boolean>;
  isExiting: WritableSignal<boolean>;

  // ─── Derived state for template consumption ──────────────────────────────────
  allPips: Signal<StreamPipEntry[]>;
  /** The currently featured pip, or `undefined` when none is active. */
  featuredPip: Signal<StreamPipEntry | undefined>;
  shouldShowWindow: Signal<boolean>;
  gridCols: Signal<number>;
  gridRows: Signal<number>;
  /** Per-cell layout data — iterate over this in `@for` instead of calling methods. */
  cells: Signal<PipCellData[]>;
  /** True when more than one pip is active (shows the grid-toggle button). */
  hasMultiplePips: Signal<boolean>;
  /** True when the back button should be visible. */
  showBackButton: Signal<boolean>;
  /** Accessible label for the grid toggle button. */
  gridToggleLabel: Signal<string>;

  // ─── Actions ─────────────────────────────────────────────────────────────────
  setFeatured(playerId: StreamPlayerId): void;
  /**
   * Closes all pip entries, optionally animating via the pip window.
   * Call on the close button's click event.
   */
  close(event: Event, pipWindow: PipWindowComponent | undefined): void;
};

/**
 * Creates all reactive state for the pip chrome.
 * Call inside a component or directive constructor (injection context required).
 * Does not touch the DOM — use `injectPipChromeAnimations` for that.
 */
export function createPipChromeState(): PipChromeState {
  const pipManager = injectPipManager();

  const featuredId = signal<StreamPlayerId | null>(null);
  const multiView = signal(false);
  const isExiting = signal(false);

  const allPips = computed(() => pipManager.pips());

  const featuredPip = computed((): StreamPipEntry | undefined => {
    const pips = pipManager.pips();
    if (!pips.length) return undefined;
    const id = featuredId();
    if (id) {
      const match = pips.find((p) => p.playerId === id);
      if (match) return match;
    }
    return pips[0];
  });

  const shouldShowWindow = computed(() => !!featuredPip() || isExiting());
  const gridCols = computed(() => Math.max(1, Math.ceil(Math.sqrt(allPips().length))));
  const gridRows = computed(() => Math.max(1, Math.ceil(allPips().length / gridCols())));

  const cells = computed((): PipCellData[] => {
    const pips = allPips();
    const cols = gridCols();
    const featured = featuredPip();
    const isGrid = multiView();

    const fIdx = featured
      ? Math.max(
          0,
          pips.findIndex((p) => p.playerId === featured.playerId),
        )
      : 0;
    const fCol = (fIdx % cols) + 1;
    const fRow = Math.floor(fIdx / cols) + 1;

    return pips.map((pip, i) => {
      const col = (i % cols) + 1;
      const row = Math.floor(i / cols) + 1;
      const isFeatured = pip.playerId === featured?.playerId;
      const isInert = !isGrid && !isFeatured;

      return {
        pip,
        playerId: pip.playerId,
        col,
        row,
        exitH: isGrid ? 0 : col !== fCol ? col - fCol : 0,
        exitV: isGrid ? 0 : row !== fRow ? row - fRow : 0,
        isFeatured,
        inertAttr: isInert ? '' : null,
        // Player is inert in grid mode (cell overlay handles clicks) and for non-featured in single mode.
        playerInertAttr: isGrid || !isFeatured ? '' : null,
        gridRole: isGrid ? 'button' : null,
        gridTabIndex: isGrid ? 0 : null,
      };
    });
  });

  const hasMultiplePips = computed(() => allPips().length > 1);
  const showBackButton = computed(() => !!featuredPip()?.onBack && !multiView());
  const gridToggleLabel = computed(() => (multiView() ? 'Single view' : 'Grid view'));

  // Clear stale featuredId when the pip it references is deactivated.
  effect(() => {
    const pips = pipManager.pips();
    const id = featuredId();
    if (id && !pips.find((p) => p.playerId === id)) {
      untracked(() => featuredId.set(null));
    }
  });

  // Keep the pipManager's featuredPipId in sync. Null in grid mode so the
  // manager treats all pips as equally reachable (uses flip for all).
  effect(() => {
    const featured = featuredPip();
    pipManager.setFeaturedPip(multiView() ? null : (featured?.playerId ?? null));
  });

  const setFeatured = (playerId: StreamPlayerId): void => {
    featuredId.set(playerId);
  };

  const close = (event: Event, pipWindow: PipWindowComponent | undefined): void => {
    event.stopPropagation();
    const pips = untracked(() => allPips());

    if (!pipWindow) {
      for (const pip of pips) pipManager.pipDeactivate(pip.playerId);
      return;
    }

    isExiting.set(true);
    pipWindow.posState.animateExit(() => {
      for (const pip of pips) pipManager.pipDeactivate(pip.playerId, { animation: 'scaleFadeIn' });
      isExiting.set(false);
    });
  };

  return {
    featuredId,
    multiView,
    isExiting,
    allPips,
    featuredPip,
    shouldShowWindow,
    gridCols,
    gridRows,
    cells,
    hasMultiplePips,
    showBackButton,
    gridToggleLabel,
    setFeatured,
    close,
  };
}
