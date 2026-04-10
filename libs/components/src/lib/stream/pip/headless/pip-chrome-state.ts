import { Signal, WritableSignal, computed, effect, linkedSignal, signal, untracked } from '@angular/core';
import { injectPipManager } from '../../pip-manager';
import { StreamPipEntry, StreamPlayerId } from '../../stream-manager.types';
import { PipWindowComponent } from '../pip-window.component';

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
  featuredId: WritableSignal<StreamPlayerId | null>;
  multiView: WritableSignal<boolean>;
  isExiting: WritableSignal<boolean>;

  allPips: Signal<StreamPipEntry[]>;
  /** The currently featured pip, or `undefined` when none is active. */
  featuredPip: Signal<StreamPipEntry | undefined>;
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
  /** The natural aspect ratio of the currently featured pip. */
  featuredAspectRatio: Signal<number>;
  /**
   * The aspect ratio to apply to the pip window.
   * In single mode: tracks the featured pip's ratio.
   * In grid mode: locked to the ratio at the time grid was entered; unlocks when a pip is removed.
   */
  windowAspectRatio: Signal<number>;

  setFeatured(playerId: StreamPlayerId): void;
  /** Closes all pip entries, optionally animating via the pip window. */
  close(event: Event, pipWindow: PipWindowComponent | undefined): void;

  /** @internal Map from playerId to the host HTMLElement. Populated by PipCellDirective. */
  cellElements: Map<StreamPlayerId, HTMLElement>;
  /** @internal */
  registerCell(playerId: StreamPlayerId, el: HTMLElement): void;
  /** @internal */
  unregisterCell(playerId: StreamPlayerId): void;
};

export const createPipChromeState = (): PipChromeState => {
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
        playerInertAttr: isGrid || !isFeatured ? '' : null,
        gridRole: isGrid ? 'button' : null,
        gridTabIndex: isGrid ? 0 : null,
      };
    });
  });

  const hasMultiplePips = computed(() => allPips().length > 1);
  const showBackButton = computed(() => !!featuredPip()?.onBack && !multiView());
  const gridToggleLabel = computed(() => (multiView() ? 'Single view' : 'Grid view'));

  const featuredAspectRatio = computed(() => featuredPip()?.aspectRatio ?? 16 / 9);

  let prevMultiPipCount = allPips().length;
  const windowAspectRatio = linkedSignal<{ multi: boolean; exiting: boolean; ar: number; pipCount: number }, number>({
    source: () => ({ multi: multiView(), exiting: isExiting(), ar: featuredAspectRatio(), pipCount: allPips().length }),
    computation: ({ multi, exiting, ar, pipCount }, prev) => {
      const pipCountChanged = pipCount !== prevMultiPipCount;
      prevMultiPipCount = pipCount;
      return !multi || exiting || pipCountChanged ? ar : (prev?.value ?? ar);
    },
  });

  effect(() => {
    const pips = pipManager.pips();
    const id = featuredId();
    if (id && !pips.find((p) => p.playerId === id)) {
      untracked(() => featuredId.set(null));
    }
  });

  effect(() => {
    const featured = featuredPip();
    pipManager.setFeaturedPip(multiView() ? null : (featured?.playerId ?? null));
  });

  const setFeatured = (playerId: StreamPlayerId) => {
    featuredId.set(playerId);
  };

  const cellElements = new Map<StreamPlayerId, HTMLElement>();

  const registerCell = (playerId: StreamPlayerId, el: HTMLElement) => {
    cellElements.set(playerId, el);
  };

  const unregisterCell = (playerId: StreamPlayerId) => {
    cellElements.delete(playerId);
  };

  const close = (event: Event, pipWindow: PipWindowComponent | undefined) => {
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
    gridCols,
    gridRows,
    cells,
    hasMultiplePips,
    showBackButton,
    gridToggleLabel,
    featuredAspectRatio,
    windowAspectRatio,
    setFeatured,
    close,
    cellElements,
    registerCell,
    unregisterCell,
  };
};
