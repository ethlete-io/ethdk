import { DOCUMENT, inject } from '@angular/core';
import { createFlipAnimation, createRootProvider, injectRenderer } from '@ethlete/core';
import { StreamManager, StreamPlayerEntry, StreamPlayerId, StreamSlotEntry } from './stream-manager.types';

type InternalPlayerEntry = StreamPlayerEntry & {
  /** True while this player is in PIP mode — prevents slot reassignment. */
  isInPip: boolean;
  /**
   * True while the exit (pip→slot) animation is in flight.
   * `reassignPlayer()` skips this player so the animation wrapper keeps ownership.
   */
  isAnimatingOut: boolean;
};

export const [provideStreamManager, injectStreamManager] = createRootProvider(
  (): StreamManager => {
    const document = inject(DOCUMENT);
    const renderer = injectRenderer();

    const container = renderer.createElement('div');
    renderer.addClass(container, 'et-stream-manager');
    renderer.appendChild(document.body, container);

    const players = new Map<StreamPlayerId, InternalPlayerEntry>();
    const slots = new Map<HTMLElement, StreamSlotEntry>();

    const resolveBestSlot = (playerId: StreamPlayerId): StreamSlotEntry | null => {
      let best: StreamSlotEntry | null = null;

      for (const slot of slots.values()) {
        if (slot.playerId !== playerId) continue;
        if (!best) {
          best = slot;
          continue;
        }
        if (!best.priority) {
          best = slot;
          continue;
        }
        if (slot.priority) {
          best = slot;
        }
      }

      return best;
    };

    const isInViewport = (r: DOMRect) =>
      r.width > 0 &&
      r.height > 0 &&
      r.right > 0 &&
      r.bottom > 0 &&
      r.left < window.innerWidth &&
      r.top < window.innerHeight;

    const moveWithFlip = (element: HTMLElement, targetParent: HTMLElement) => {
      const initialRect = element.getBoundingClientRect();
      if (!isInViewport(initialRect)) {
        renderer.moveBefore({ newParent: targetParent, child: element });
        return;
      }
      const flip = createFlipAnimation({ element });
      flip.updateInit();
      renderer.moveBefore({ newParent: targetParent, child: element });
      flip.play();
    };

    const hasSlotFor = (playerId: StreamPlayerId) => {
      for (const slot of slots.values()) {
        if (slot.playerId === playerId) return true;
      }
      return false;
    };

    const reassignPlayer = (playerId: StreamPlayerId) => {
      const player = players.get(playerId);
      if (!player || player.isInPip || player.isAnimatingOut) return;

      const bestSlot = resolveBestSlot(playerId);
      const targetParent = bestSlot?.element ?? container;

      if (player.element.parentElement !== targetParent) {
        moveWithFlip(player.element, targetParent);
      }
    };

    const registerPlayer = (entry: StreamPlayerEntry) => {
      const internal: InternalPlayerEntry = {
        ...entry,
        isInPip: false,
        isAnimatingOut: false,
      };
      players.set(entry.id, internal);
      renderer.appendChild(container, entry.element);
      reassignPlayer(entry.id);
    };

    const unregisterPlayer = (playerId: StreamPlayerId) => {
      const entry = players.get(playerId);
      if (!entry) return;
      entry.element.remove();
      players.delete(playerId);
      entry.onDestroy?.();
    };

    const registerSlot = (entry: StreamSlotEntry) => {
      slots.set(entry.element, entry);
      reassignPlayer(entry.playerId);
    };

    const unregisterSlot = (element: HTMLElement) => {
      const slot = slots.get(element);
      if (!slot) return;
      slots.delete(element);

      const player = players.get(slot.playerId);
      if (!player) return;

      if (player.isInPip) return;

      if (player.element.parentElement === element) {
        if (hasSlotFor(slot.playerId)) {
          reassignPlayer(slot.playerId);
        } else {
          unregisterPlayer(slot.playerId);
        }
      }
    };

    const transferPlayer = (oldId: StreamPlayerId, newId: StreamPlayerId) => {
      const entry = players.get(oldId);
      if (!entry || oldId === newId) return;
      players.delete(oldId);
      players.set(newId, { ...entry, id: newId });
    };

    const getPlayerElement = (playerId: StreamPlayerId): HTMLElement | null => players.get(playerId)?.element ?? null;

    const getPlayerEntry = (playerId: StreamPlayerId): StreamPlayerEntry | null => {
      const entry = players.get(playerId);
      if (!entry) return null;
      return { id: entry.id, element: entry.element, onDestroy: entry.onDestroy, thumbnail: entry.thumbnail };
    };

    const getSlot = (element: HTMLElement): StreamSlotEntry | null => slots.get(element) ?? null;

    const movePlayerToContainer = (playerId: StreamPlayerId) => {
      const player = players.get(playerId);
      if (!player) return;
      if (player.element.parentElement === container) return;
      renderer.moveBefore({ newParent: container, child: player.element });
    };

    const setPlayerInPip = (playerId: StreamPlayerId, inPip: boolean) => {
      const player = players.get(playerId);
      if (player) player.isInPip = inPip;
    };

    const isPlayerInPip = (playerId: StreamPlayerId) => players.get(playerId)?.isInPip ?? false;

    const setPlayerAnimatingOut = (playerId: StreamPlayerId, animating: boolean) => {
      const player = players.get(playerId);
      if (player) player.isAnimatingOut = animating;
    };

    return {
      hasSlotFor,
      registerPlayer,
      unregisterPlayer,
      registerSlot,
      unregisterSlot,
      transferPlayer,
      getPlayerElement,
      getPlayerEntry,
      getSlot,
      resolveBestSlot,
      movePlayerToContainer,
      setPlayerInPip,
      isPlayerInPip,
      setPlayerAnimatingOut,
    };
  },
  { name: 'Stream Manager' },
);
