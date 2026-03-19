import { Signal } from '@angular/core';

/**
 * Unique id for a stream player entry.
 * Convention: `'{platform}-{resourceId}'`, e.g. `'youtube-dQw4w9WgXcQ'`.
 */
export type StreamPlayerId = string;

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
};

export type StreamPipEntry = {
  /** The player that is currently in PIP mode. */
  playerId: StreamPlayerId;

  /**
   * Optional callback invoked when the user presses the "back" action inside
   * the PIP chrome for this PIP entry.
   */
  onBack?: () => void;
};

export type StreamManager = {
  /** Currently active PIP entries (one per player in PIP mode). */
  readonly pips: Signal<StreamPipEntry[]>;

  /**
   * Registers a stream player element with the manager. The element is appended
   * to the body-level manager container. If a slot is already waiting for this
   * player id, the player is immediately moved into it (FLIP-animated).
   */
  registerPlayer(entry: StreamPlayerEntry): void;

  /**
   * Unregisters a player and removes its element from the DOM.
   */
  unregisterPlayer(playerId: StreamPlayerId): void;

  /**
   * Registers a slot. If a player with a matching id already exists, it is
   * immediately moved into the best available slot (FLIP-animated).
   */
  registerSlot(entry: StreamSlotEntry): void;

  /**
   * Unregisters the slot identified by `element`. If the player was in this
   * slot and is not currently in PIP mode, the player is moved back to the body
   * PIP container. If the player IS in PIP mode, it stays in PIP.
   */
  unregisterSlot(element: HTMLElement): void;

  /**
   * Moves the player currently in the slot identified by `element` into the
   * body PIP container, activating PIP mode.
   */
  pipActivate(element: HTMLElement, onBack?: () => void): void;

  /**
   * Deactivates PIP for `playerId` and moves the player back to the best
   * available slot (highest priority / last registered). If no slot exists, the
   * player stays in the body container.
   */
  pipDeactivate(playerId: StreamPlayerId): void;

  /**
   * Re-keys a player entry from `oldId` to `newId` without touching the DOM.
   * Use this when the video id changes on an existing slot (e.g. playlist navigation)
   * so the manager's internal tracking stays consistent.
   */
  transferPlayer(oldId: StreamPlayerId, newId: StreamPlayerId): void;

  /**
   * Returns the live DOM element for `playerId`, or `null` if the player is not
   * registered. Use this to move the element into a PIP chrome entry.
   */
  getPlayerElement(playerId: StreamPlayerId): HTMLElement | null;

  /**
   * Consumes and returns the rect captured just before `pipActivate` moved the player
   * to the body container. Returns `null` if no rect was stored.
   * Deleted on first read so the enter animation only fires once.
   */
  getInitialRect(playerId: StreamPlayerId): DOMRect | null;
};
