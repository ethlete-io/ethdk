import { DOCUMENT, inject, signal } from '@angular/core';
import { createFlipAnimation, createRootProvider, injectRenderer } from '@ethlete/core';
import {
  StreamManager,
  StreamPipEntry,
  StreamPlayerEntry,
  StreamPlayerId,
  StreamSlotEntry,
} from './stream-manager.types';
import { animateWithFixedWrapper, pipMoveBefore } from './stream-pip';

type InternalPlayerEntry = StreamPlayerEntry & {
  currentSlotElement: HTMLElement | null;
  /**
   * True when the owning slot was destroyed while the player was in PIP mode.
   * The player will be cleaned up (via `onDestroy`) when PIP is eventually closed.
   */
  isOrphaned: boolean;
  /**
   * True while the exit (pip→slot) animation is in flight.
   * parkPlayerElement() skips this player so the animation wrapper keeps ownership.
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
    const pips = signal<StreamPipEntry[]>([]);
    const pipInitialRects = new Map<StreamPlayerId, DOMRect>();

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

    const moveWithFlip = (element: HTMLElement, targetParent: HTMLElement): void => {
      const initialRect = element.getBoundingClientRect();
      if (initialRect.width === 0 && initialRect.height === 0) {
        pipMoveBefore(targetParent, element);
        return;
      }
      const flip = createFlipAnimation({ element });
      flip.updateInit();
      pipMoveBefore(targetParent, element);
      flip.play();
    };

    const hasSlotFor = (playerId: StreamPlayerId): boolean => {
      for (const slot of slots.values()) {
        if (slot.playerId === playerId) return true;
      }
      return false;
    };

    const isInPip = (playerId: StreamPlayerId): boolean => pips().some((p) => p.playerId === playerId);

    const reassignPlayer = (playerId: StreamPlayerId): void => {
      const player = players.get(playerId);
      if (!player || isInPip(playerId)) return;

      const bestSlot = resolveBestSlot(playerId);
      const targetParent = bestSlot?.element ?? container;

      if (player.element.parentElement !== targetParent) {
        moveWithFlip(player.element, targetParent);
        player.currentSlotElement = bestSlot?.element ?? null;
      }
    };

    const registerPlayer = (entry: StreamPlayerEntry): void => {
      const internal: InternalPlayerEntry = {
        ...entry,
        currentSlotElement: null,
        isOrphaned: false,
        isAnimatingOut: false,
      };
      players.set(entry.id, internal);
      renderer.appendChild(container, entry.element);
      reassignPlayer(entry.id);
    };

    const unregisterPlayer = (playerId: StreamPlayerId): void => {
      const entry = players.get(playerId);
      if (!entry) return;
      entry.element.remove();
      players.delete(playerId);
      pips.update((pips) => pips.filter((p) => p.playerId !== playerId));
      entry.onDestroy?.();
    };

    const registerSlot = (entry: StreamSlotEntry): void => {
      slots.set(entry.element, entry);
      const player = players.get(entry.playerId);
      if (player?.isOrphaned) player.isOrphaned = false;
      reassignPlayer(entry.playerId);
    };

    const unregisterSlot = (element: HTMLElement): void => {
      const slot = slots.get(element);
      if (!slot) return;
      slots.delete(element);

      const player = players.get(slot.playerId);
      if (!player) return;

      const hasOtherSlot = hasSlotFor(slot.playerId);

      if (isInPip(slot.playerId)) {
        if (!hasOtherSlot) player.isOrphaned = true;
        return;
      }

      if (player.currentSlotElement === element) {
        if (hasOtherSlot) {
          reassignPlayer(slot.playerId);
        } else {
          unregisterPlayer(slot.playerId);
        }
      }
    };

    const pipActivate = (element: HTMLElement, onBack?: () => void): void => {
      const slot = slots.get(element);
      if (!slot) return;

      const player = players.get(slot.playerId);
      if (!player || isInPip(slot.playerId)) return;

      const initialRect = player.element.getBoundingClientRect();
      if (initialRect.width > 0 || initialRect.height > 0) {
        pipInitialRects.set(slot.playerId, initialRect);
      }

      pipMoveBefore(container, player.element);
      player.currentSlotElement = null;
      pips.update((pips) => [...pips, { playerId: slot.playerId, onBack: onBack ?? slot.onPipBack }]);
    };

    const pipDeactivate = (playerId: StreamPlayerId): void => {
      if (!isInPip(playerId)) return;

      pipInitialRects.delete(playerId);

      const player = players.get(playerId);
      if (!player) {
        pips.update((pips) => pips.filter((p) => p.playerId !== playerId));
        return;
      }

      if (player.isOrphaned) {
        pips.update((pips) => pips.filter((p) => p.playerId !== playerId));
        unregisterPlayer(playerId);
        return;
      }

      const fromRect = player.element.getBoundingClientRect();
      const bestSlot = resolveBestSlot(playerId);
      const targetParent = bestSlot?.element ?? container;
      const toRect = targetParent.getBoundingClientRect();

      if (fromRect.width > 0 && fromRect.height > 0 && toRect.width > 0 && toRect.height > 0) {
        player.isAnimatingOut = true;
        animateWithFixedWrapper({
          playerEl: player.element,
          fromRect,
          toRect,
          document,
          onFinish: () => {
            player.isAnimatingOut = false;
            pipMoveBefore(targetParent, player.element);
            player.currentSlotElement = bestSlot?.element ?? null;
          },
        });
      } else {
        pipMoveBefore(targetParent, player.element);
        player.currentSlotElement = bestSlot?.element ?? null;
      }

      pips.update((pips) => pips.filter((p) => p.playerId !== playerId));
    };

    const transferPlayer = (oldId: StreamPlayerId, newId: StreamPlayerId): void => {
      const entry = players.get(oldId);
      if (!entry || oldId === newId) return;
      players.delete(oldId);
      players.set(newId, { ...entry, id: newId });
      pips.update((pips) => pips.map((p) => (p.playerId === oldId ? { ...p, playerId: newId } : p)));
    };

    const getPlayerElement = (playerId: StreamPlayerId): HTMLElement | null => players.get(playerId)?.element ?? null;

    const getInitialRect = (playerId: StreamPlayerId): DOMRect | null => {
      const rect = pipInitialRects.get(playerId) ?? null;
      pipInitialRects.delete(playerId);
      return rect;
    };

    const parkPlayerElement = (playerId: StreamPlayerId): void => {
      const player = players.get(playerId);
      if (!player) return;
      if (player.isAnimatingOut) return;
      if (player.element.parentElement === container) return;
      pipMoveBefore(container, player.element);
    };

    return {
      pips: pips.asReadonly(),
      registerPlayer,
      unregisterPlayer,
      registerSlot,
      unregisterSlot,
      pipActivate,
      pipDeactivate,
      transferPlayer,
      getPlayerElement,
      getInitialRect,
      parkPlayerElement,
    };
  },
  { name: 'Stream Manager' },
);
