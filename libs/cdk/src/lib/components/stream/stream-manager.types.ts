import { InjectionToken, Signal } from '@angular/core';

/**
 * Unique id for a stream player entry.
 * Convention: `'{platform}-{resourceId}'`, e.g. `'youtube-dQw4w9WgXcQ'`.
 */
export type StreamPlayerId = string;

/**
 * Token provided by player-slot directives/components (e.g. `YoutubePlayerSlotDirective`).
 * Yields a reactive signal of the current player id the slot is bound to, or `null` when
 * the slot has not yet initialised. Consumed by `PipSlotPlaceholderComponent` to
 * auto-detect whether its hosting slot currently has its player in PIP mode.
 */
export const STREAM_SLOT_PLAYER_ID_TOKEN = new InjectionToken<Signal<StreamPlayerId | null>>(
  'STREAM_SLOT_PLAYER_ID_TOKEN',
);

// ─── Slot / player types ─────────────────────────────────────────────────────

export type StreamSlotEntry = {
  /**
   * The player id this slot wants to display (e.g. `'youtube-dQw4w9WgXcQ'`).
   * Multiple slots may share the same id — priority resolves which one is shown.
   */
  playerId: StreamPlayerId;

  /**
   * Whether this slot is considered high priority.
   * Among all slots registered for the same player id, `priority = true`
   * wins. If multiple high-priority slots exist, the last-registered wins.
   */
  priority: boolean;

  /**
   * The host element of the slot — used as the unique key in the manager.
   * The player element will be moved into this element when the slot is active.
   */
  element: HTMLElement;

  /**
   * Optional callback invoked when the user presses the "back" action inside the
   * PIP chrome while this slot's player is in PIP mode.
   */
  onPipBack?: () => void;
};

export type StreamPlayerEntry = {
  /** The stream player id (e.g. `'youtube-dQw4w9WgXcQ'`). */
  id: StreamPlayerId;

  /** The live DOM element of the player (lives in the body container by default). */
  element: HTMLElement;

  /**
   * Called by the manager when the player is no longer needed (no slot claims it
   * and it is not in PIP mode). Use this to destroy the underlying component ref.
   */
  onDestroy?: () => void;

  /** Reactive thumbnail URL from the player, forwarded to PIP entries. */
  thumbnail?: Signal<string | null>;
};

export type StreamPipEntry = {
  /** The player that is currently in PIP mode. */
  playerId: StreamPlayerId;

  /**
   * Optional callback invoked when the user presses the "back" action inside
   * the PIP chrome for this PIP entry.
   */
  onBack?: () => void;

  /** Reactive thumbnail URL for the player, used to render preview tiles. */
  thumbnail?: Signal<string | null>;
};

// ─── Manager types ────────────────────────────────────────────────────────────

export type StreamManager = {
  /** Returns true if at least one registered slot exists for the given player id. */
  hasSlotFor(playerId: StreamPlayerId): boolean;

  /**
   * Registers a stream player element with the manager. The element is appended
   * to the body-level manager container. If a slot is already waiting for this
   * player id, the player is immediately moved into it (FLIP-animated).
   */
  registerPlayer(entry: StreamPlayerEntry): void;

  /**
   * Unregisters a player and removes its element from the DOM.
   * Only call this when the player is not in PIP mode — PipManager handles
   * clean-up for orphaned players when PIP is closed.
   */
  unregisterPlayer(playerId: StreamPlayerId): void;

  /**
   * Registers a slot. If a player with a matching id already exists, it is
   * immediately moved into the best available slot (FLIP-animated).
   */
  registerSlot(entry: StreamSlotEntry): void;

  /**
   * Unregisters the slot identified by `element`. If the player was in this
   * slot and is not currently in PIP mode, it is moved to the next best slot
   * or fully unregistered when no slots remain. If the player IS in PIP mode,
   * it stays in PIP until deactivated.
   */
  unregisterSlot(element: HTMLElement): void;

  /**
   * Re-keys a player entry from `oldId` to `newId` without touching the DOM.
   * Use this when the video id changes on an existing slot (e.g. playlist navigation)
   * so the manager's internal tracking stays consistent.
   */
  transferPlayer(oldId: StreamPlayerId, newId: StreamPlayerId): void;

  /**
   * Returns the live DOM element for `playerId`, or `null` if the player is not
   * registered.
   */
  getPlayerElement(playerId: StreamPlayerId): HTMLElement | null;

  /**
   * Returns the full `StreamPlayerEntry` for `playerId`, or `null` if not
   * registered. Useful for reading `thumbnail` and other metadata.
   */
  getPlayerEntry(playerId: StreamPlayerId): StreamPlayerEntry | null;

  /**
   * Returns the `StreamSlotEntry` associated with `element`, or `null` if not
   * registered.
   */
  getSlot(element: HTMLElement): StreamSlotEntry | null;

  /**
   * Returns the highest-priority slot registered for `playerId`, or `null` if
   * none exists.
   */
  resolveBestSlot(playerId: StreamPlayerId): StreamSlotEntry | null;

  /**
   * Moves the player element into the manager's body container.
   * Used by PipManager for `pipActivate` and `parkPlayerElement`.
   */
  movePlayerToContainer(playerId: StreamPlayerId): void;

  /**
   * Marks the player as being in (or leaving) PIP mode. PipManager calls this
   * to keep the stream manager's internal routing decisions (e.g. `reassignPlayer`,
   * `unregisterSlot`) consistent with PIP state.
   */
  setPlayerInPip(playerId: StreamPlayerId, inPip: boolean): void;

  /** Returns `true` if the player is currently in PIP mode. */
  isPlayerInPip(playerId: StreamPlayerId): boolean;

  /**
   * Marks the player as currently running a PIP-exit animation so that
   * `reassignPlayer` does not interfere while the animation is in flight.
   */
  setPlayerAnimatingOut(playerId: StreamPlayerId, animating: boolean): void;
};

export type PipManager = {
  /** Currently active PIP entries (one per player in PIP mode). */
  readonly pips: Signal<StreamPipEntry[]>;

  /**
   * The player id of the currently featured (visible) pip in single mode.
   * `null` when in grid mode or when no chrome is active.
   * Set by the chrome so that `pipDeactivate` can automatically choose
   * `scaleFadeIn` for non-featured pips instead of FLIP.
   */
  readonly featuredPipId: Signal<StreamPlayerId | null>;

  /**
   * Called by the chrome to keep `featuredPipId` in sync.
   * Pass `null` when switching to grid mode or when no pip is active.
   */
  setFeaturedPip(playerId: StreamPlayerId | null): void;

  /**
   * Increments each time `notifyBackPressed` is called. Useful for reactive
   * consumers (e.g. `viewChild` effects in slot placeholders) that need to
   * re-check `consumeBackPulse` without polling.
   */
  readonly backPulseCounter: Signal<number>;

  /**
   * Records that the user pressed the "back" button in the PIP chrome for this
   * player. The matching `etPipBringBack` button will consume this on its first
   * render and play an attention-pulse + scroll-into-view.
   */
  notifyBackPressed(playerId: StreamPlayerId): void;

  /**
   * Returns true (and clears the flag) if `notifyBackPressed` was called for this
   * player since the last consume. Used by `etPipBringBack` on init.
   */
  consumeBackPulse(playerId: StreamPlayerId): boolean;

  /**
   * Moves the player currently in the slot identified by `element` into the
   * body PIP container, activating PIP mode.
   */
  pipActivate(element: HTMLElement, onBack?: () => void): void;

  /**
   * Deactivates PIP for `playerId` and moves the player back to the best
   * available slot (highest priority / last registered). If no slot exists, the
   * player is fully unregistered.
   *
   * Pass `{ skipAnimation: true }` to skip the exit animation.
   */
  pipDeactivate(
    playerId: StreamPlayerId,
    options?: { skipAnimation?: boolean; animation?: 'flip' | 'scaleFadeIn' },
  ): void;

  /**
   * Consumes and returns the rect captured just before `pipActivate` moved the player
   * to the body container. Returns `null` if no rect was stored.
   * Deleted on first read so the enter animation only fires once.
   */
  getInitialRect(playerId: StreamPlayerId): DOMRect | null;

  /**
   * Moves the player element back to the manager's body container without
   * changing PIP state. Call this before a pip-player component is destroyed so
   * the iframe remains connected to the document and `moveBefore` can preserve
   * its state when another pip-player picks it up immediately after.
   */
  parkPlayerElement(playerId: StreamPlayerId): void;
};
